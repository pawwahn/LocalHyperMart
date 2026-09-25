package com.hyperlocalmart.town.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.billing.AdInvoiceConflictDto;
import com.hyperlocalmart.town.dto.billing.AdInvoiceResponse;
import com.hyperlocalmart.town.dto.billing.AdInvoiceTownDto;
import com.hyperlocalmart.town.dto.billing.AdOccupancyBookingDto;
import com.hyperlocalmart.town.dto.billing.AdOccupancyResponse;
import com.hyperlocalmart.town.dto.billing.AdPeriodRateDto;
import com.hyperlocalmart.town.dto.billing.AdQuoteRequest;
import com.hyperlocalmart.town.dto.billing.AdQuoteResponse;
import com.hyperlocalmart.town.dto.billing.AdRateCardResponse;
import com.hyperlocalmart.town.dto.billing.AdRatesDocument;
import com.hyperlocalmart.town.dto.billing.AdSlotRateDto;
import com.hyperlocalmart.town.dto.billing.CreateAdInvoiceRequest;
import com.hyperlocalmart.town.dto.billing.PayAdInvoiceRequest;
import com.hyperlocalmart.town.dto.billing.UpsertAdRateCardRequest;
import com.hyperlocalmart.town.dto.billing.VoidAdInvoiceRequest;
import com.hyperlocalmart.town.entity.AdBillPeriod;
import com.hyperlocalmart.town.entity.AdInvoice;
import com.hyperlocalmart.town.entity.AdInvoiceStatus;
import com.hyperlocalmart.town.entity.AdRateCard;
import com.hyperlocalmart.town.entity.AdTownScope;
import com.hyperlocalmart.town.entity.Town;
import com.hyperlocalmart.town.entity.TownAdSlot;
import com.hyperlocalmart.town.entity.TownStatus;
import com.hyperlocalmart.town.repository.AdInvoiceRepository;
import com.hyperlocalmart.town.repository.AdRateCardRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdBillingService {

    public static final int MID_GRID_SLOTS = 5;
    public static final int MAX_TOWNS = 200;
    public static final int MAX_DAYS = 1096;
    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter INVOICE_DAY = DateTimeFormatter.ofPattern("ddMMyy");
    private static final Pattern PHONE = Pattern.compile("^[6-9]\\d{9}$");
    private static final Pattern GSTIN = Pattern.compile("^[0-9A-Z]{15}$");
    private static final Set<String> PAY_METHODS = Set.of("UPI", "NEFT", "IMPS", "RTGS", "CASH", "CHEQUE", "OTHER");
    private static final List<AdInvoiceStatus> ACTIVE = List.of(AdInvoiceStatus.ISSUED, AdInvoiceStatus.PAID);
    private static final TypeReference<List<UUID>> UUID_LIST = new TypeReference<>() {};

    private final AdRateCardRepository rateCardRepository;
    private final AdInvoiceRepository invoiceRepository;
    private final TownRepository townRepository;
    private final ObjectMapper objectMapper;
    private final AdminAuditor adminAuditService;

    @Transactional(readOnly = true)
    public AdRateCardResponse getRateCard() {
        return toRateCardResponse(loadOrCreateCard());
    }

    @Transactional
    public AdRateCardResponse saveRateCard(UpsertAdRateCardRequest request, UUID actorId) {
        AdRateCard card = loadOrCreateCard();
        AdRatesDocument before = readRates(card);
        BigDecimal tax = money(nz(request.getTaxPercent()));
        if (tax.compareTo(BigDecimal.ZERO) < 0 || tax.compareTo(new BigDecimal("28")) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "GST must be between 0 and 28%");
        }
        AdRatesDocument doc = AdRatesDocument.builder()
                .homeHero(requireSlotRates("Main ad (home strip)", request.getHomeHero()))
                .homeMidGrid(requireSlotRates("Mid-grid ad", request.getHomeMidGrid()))
                .cartUpsell(requireSlotRates("Cart ad", request.getCartUpsell()))
                .build();
        card.setTaxPercent(tax);
        card.setNotes(trimTo(request.getNotes(), 500));
        card.setRatesJson(writeJson(doc));
        card.setUpdatedBy(actorId);
        rateCardRepository.save(card);
        adminAuditService.record(
                "ads-rates",
                "UPDATE_AD_RATES",
                "Updated ad rate card · GST " + tax.stripTrailingZeros().toPlainString() + "%",
                actorId,
                "SUPER_ADMIN",
                null,
                "AD_RATE_CARD",
                card.getId(),
                before,
                doc);
        return toRateCardResponse(card);
    }

    @Transactional(readOnly = true)
    public AdQuoteResponse quote(AdQuoteRequest request) {
        return buildQuote(request.getSlot(), request.getSlotIndex(), request.getPeriod(), request.getTownScope(),
                request.getTownIds(), request.getFromDate(), request.getToDate(), null);
    }

    @Transactional
    public AdInvoiceResponse createInvoice(CreateAdInvoiceRequest request, UUID actorId) {
        String name = trimRequired(request.getAdvertiserName(), 160, "Advertiser name");
        String phone = normalizePhone(request.getAdvertiserPhone());
        String gstin = normalizeGstin(request.getAdvertiserGstin());
        AdQuoteResponse quote = buildQuote(
                request.getSlot(),
                request.getSlotIndex(),
                request.getPeriod(),
                request.getTownScope(),
                request.getTownIds(),
                request.getFromDate(),
                request.getToDate(),
                null);
        if (quote.getConflicts() != null && !quote.getConflicts().isEmpty()) {
            AdInvoiceConflictDto first = quote.getConflicts().get(0);
            String next = quote.getNextFreeFrom() != null
                    ? " Next free window: " + quote.getNextFreeFrom() + " to " + quote.getNextFreeTo() + "."
                    : "";
            throw new BusinessException(ErrorCode.CONFLICT,
                    "This slot is already booked by " + first.getInvoiceNumber() + " (" + first.getAdvertiserName()
                            + ") " + first.getFromDate() + "–" + first.getToDate()
                            + ". Pick free dates or void that bill." + next);
        }
        Instant now = Instant.now();
        AdInvoice invoice = AdInvoice.builder()
                .invoiceNumber(nextInvoiceNumber())
                .status(AdInvoiceStatus.ISSUED)
                .advertiserName(name)
                .advertiserPhone(phone)
                .advertiserGstin(gstin)
                .notes(trimTo(request.getNotes(), 500))
                .slot(quote.getSlot())
                .slotIndex(quote.getSlotIndex())
                .period(quote.getPeriod())
                .townScope(quote.getTownScope())
                .allTowns(quote.isAllTowns())
                .townIdsJson(writeJson(quote.getTownIds() == null ? List.of() : quote.getTownIds()))
                .fromDate(quote.getFromDate())
                .toDate(quote.getToDate())
                .calendarDays(quote.getCalendarDays())
                .billableUnits(quote.getBillableUnits())
                .unitOneTown(quote.getUnitOneTown())
                .unitExtraTown(quote.getUnitExtraTown())
                .unitAllTowns(quote.getUnitAllTowns())
                .taxPercent(quote.getTaxPercent())
                .subtotal(quote.getSubtotal())
                .taxAmount(quote.getTaxAmount())
                .total(quote.getTotal())
                .issuedAt(now)
                .issuedBy(actorId)
                .build();
        invoice.setCreatedBy(actorId);
        invoice.setUpdatedBy(actorId);
        invoiceRepository.save(invoice);
        adminAuditService.record(
                "ads-bills",
                "ISSUE_AD_INVOICE",
                invoice.getInvoiceNumber() + " issued · " + slotLabel(invoice.getSlot(), invoice.getSlotIndex())
                        + " · ₹" + invoice.getTotal().toPlainString() + " · unpaid",
                actorId,
                "SUPER_ADMIN",
                primaryTownId(quote.getTownIds()),
                "AD_INVOICE",
                invoice.getId(),
                null,
                Map.of(
                        "invoiceNumber", invoice.getInvoiceNumber(),
                        "advertiserName", name,
                        "total", invoice.getTotal(),
                        "status", invoice.getStatus().name()));
        return toInvoiceResponse(invoice);
    }

    @Transactional(readOnly = true)
    public PageResponse<AdInvoiceResponse> listInvoices(
            AdInvoiceStatus status,
            TownAdSlot slot,
            String q,
            LocalDate from,
            LocalDate to,
            int page,
            int size) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        int safePage = Math.max(page, 0);
        var pageable = PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "issuedAt"));
        var result = invoiceRepository.findAll(invoiceFilter(status, slot, q, from, to), pageable);
        return PageResponse.<AdInvoiceResponse>builder()
                .items(result.getContent().stream().map(this::toInvoiceResponse).toList())
                .page(result.getNumber())
                .size(result.getSize())
                .totalElements(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public AdInvoiceResponse getInvoice(UUID id) {
        return toInvoiceResponse(requireInvoice(id));
    }

    @Transactional
    public AdInvoiceResponse markPaid(UUID id, PayAdInvoiceRequest request, UUID actorId) {
        AdInvoice invoice = requireInvoice(id);
        if (invoice.getStatus() == AdInvoiceStatus.VOID) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Cannot mark a void invoice as paid");
        }
        if (invoice.getStatus() == AdInvoiceStatus.PAID) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    invoice.getInvoiceNumber() + " is already paid (" + invoice.getPaidMethod()
                            + " · " + invoice.getPaidReference() + ")");
        }
        String method = request.getMethod() == null ? "" : request.getMethod().trim().toUpperCase(Locale.ROOT);
        if (!PAY_METHODS.contains(method)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Payment method must be UPI, NEFT, IMPS, RTGS, CASH, CHEQUE, or OTHER");
        }
        String reference = request.getReference() == null ? "" : request.getReference().trim();
        if (reference.length() < 3) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Txn ref is required (UTR / UPI / cheque number)");
        }
        if (reference.length() > 80) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Txn ref is too long");
        }
        AdInvoiceStatus before = invoice.getStatus();
        invoice.setStatus(AdInvoiceStatus.PAID);
        invoice.setPaidAt(Instant.now());
        invoice.setPaidMethod(method);
        invoice.setPaidReference(trimTo(reference, 80));
        invoice.setPaidBy(actorId);
        invoice.setUpdatedBy(actorId);
        invoiceRepository.save(invoice);
        adminAuditService.record(
                "ads-bills",
                "PAY_AD_INVOICE",
                invoice.getInvoiceNumber() + " marked paid · " + method + " · " + reference
                        + " · ₹" + invoice.getTotal().toPlainString(),
                actorId,
                "SUPER_ADMIN",
                primaryTownId(readTownIds(invoice)),
                "AD_INVOICE",
                invoice.getId(),
                Map.of("status", before.name()),
                Map.of("status", "PAID", "paidMethod", method, "paidReference", reference, "total", invoice.getTotal()));
        return toInvoiceResponse(invoice);
    }

    @Transactional
    public AdInvoiceResponse voidInvoice(UUID id, VoidAdInvoiceRequest request, UUID actorId) {
        AdInvoice invoice = requireInvoice(id);
        if (invoice.getStatus() == AdInvoiceStatus.VOID) {
            throw new BusinessException(ErrorCode.CONFLICT, invoice.getInvoiceNumber() + " is already void");
        }
        if (invoice.getStatus() == AdInvoiceStatus.PAID) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Paid invoices cannot be voided. Keep the payment trail.");
        }
        String reason = trimRequired(request.getReason(), 240, "Void reason");
        AdInvoiceStatus before = invoice.getStatus();
        invoice.setStatus(AdInvoiceStatus.VOID);
        invoice.setVoidedAt(Instant.now());
        invoice.setVoidReason(reason);
        invoice.setVoidedBy(actorId);
        invoice.setUpdatedBy(actorId);
        invoiceRepository.save(invoice);
        adminAuditService.record(
                "ads-bills",
                "VOID_AD_INVOICE",
                invoice.getInvoiceNumber() + " voided · " + reason,
                actorId,
                "SUPER_ADMIN",
                primaryTownId(readTownIds(invoice)),
                "AD_INVOICE",
                invoice.getId(),
                Map.of("status", before.name()),
                Map.of("status", "VOID", "voidReason", reason));
        return toInvoiceResponse(invoice);
    }

    private AdQuoteResponse buildQuote(
            TownAdSlot slot,
            Integer slotIndexRaw,
            AdBillPeriod period,
            AdTownScope scope,
            List<UUID> townIdsRaw,
            LocalDate fromDate,
            LocalDate toDate,
            UUID ignoreInvoiceId) {
        if (slot == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Ad slot is required");
        }
        if (period == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Billing period is required");
        }
        if (scope == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Town scope is required");
        }
        if (fromDate == null || toDate == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "From date and till date are required");
        }
        if (toDate.isBefore(fromDate)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Till date cannot be before from date");
        }
        long days = ChronoUnit.DAYS.between(fromDate, toDate) + 1;
        if (days < 1 || days > MAX_DAYS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Ad run must be between 1 and " + MAX_DAYS + " days");
        }
        int slotIndex = normalizeSlotIndex(slot, slotIndexRaw);
        int units = switch (period) {
            case DAY -> (int) days;
            case WEEK -> (int) Math.ceil(days / 7.0d);
            case MONTH -> (int) Math.ceil(days / 30.0d);
            case YEAR -> (int) Math.ceil(days / 365.0d);
        };
        List<UUID> townIds = normalizeTownIds(scope, townIdsRaw);
        int enabledTownCount = (int) townRepository.findByStatusOrderByDisplayNameAsc(TownStatus.ENABLED).size();
        int townCount = scope == AdTownScope.ALL_TOWNS ? Math.max(enabledTownCount, 1) : townIds.size();
        AdRateCard card = loadOrCreateCard();
        AdRatesDocument rates = readRates(card);
        AdPeriodRateDto unit = periodRates(slotRates(rates, slot), period);
        BigDecimal one = money(nz(unit.getOneTown()));
        BigDecimal extra = money(nz(unit.getExtraTown()));
        BigDecimal all = money(nz(unit.getAllTowns()));
        if (one.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Set a one-town price for " + slotLabel(slot, slotIndex) + " / " + period.name().toLowerCase()
                            + " on the rate card before billing");
        }
        if (scope == AdTownScope.ALL_TOWNS && all.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Set an all-towns price for " + slotLabel(slot, slotIndex) + " / " + period.name().toLowerCase()
                            + " on the rate card before billing");
        }
        BigDecimal unitRate = switch (scope) {
            case ONE_TOWN -> one;
            case MULTI_TOWN -> one.add(extra.multiply(BigDecimal.valueOf(townCount - 1L)));
            case ALL_TOWNS -> all;
        };
        unitRate = money(unitRate);
        BigDecimal subtotal = money(unitRate.multiply(BigDecimal.valueOf(units)));
        BigDecimal taxPercent = money(nz(card.getTaxPercent()));
        BigDecimal taxAmount = money(subtotal.multiply(taxPercent).divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP));
        BigDecimal total = money(subtotal.add(taxAmount));
        List<AdInvoiceTownDto> towns = townsFor(scope, townIds);
        String breakdown = breakdown(scope, slot, slotIndex, period, days, units, townCount, unitRate, subtotal, taxPercent, taxAmount);
        List<AdInvoiceConflictDto> conflicts = findConflicts(slot, slotIndex, fromDate, toDate, scope, townIds, ignoreInvoiceId);
        boolean available = conflicts.isEmpty();
        DateWindow nextFree = available ? null : nextFreeWindow(slot, slotIndex, scope, townIds, (int) days, fromDate, ignoreInvoiceId);
        return AdQuoteResponse.builder()
                .slot(slot)
                .slotIndex(slotIndex)
                .slotLabel(slotLabel(slot, slotIndex))
                .period(period)
                .townScope(scope)
                .allTowns(scope == AdTownScope.ALL_TOWNS)
                .townIds(townIds)
                .towns(towns)
                .townCount(townCount)
                .enabledTownCount(enabledTownCount)
                .fromDate(fromDate)
                .toDate(toDate)
                .calendarDays((int) days)
                .billableUnits(units)
                .unitOneTown(one)
                .unitExtraTown(extra)
                .unitAllTowns(all)
                .unitRate(unitRate)
                .subtotal(subtotal)
                .taxPercent(taxPercent)
                .taxAmount(taxAmount)
                .total(total)
                .breakdown(breakdown)
                .conflicts(conflicts)
                .available(available)
                .nextFreeFrom(nextFree == null ? null : nextFree.from())
                .nextFreeTo(nextFree == null ? null : nextFree.to())
                .build();
    }

    @Transactional(readOnly = true)
    public AdOccupancyResponse occupancy(LocalDate fromDate, LocalDate toDate, UUID townId, TownAdSlot slot) {
        LocalDate from = fromDate == null ? LocalDate.now(IST).withDayOfMonth(1) : fromDate;
        LocalDate to = toDate == null ? from.withDayOfMonth(from.lengthOfMonth()) : toDate;
        if (to.isBefore(from)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Till date cannot be before from date");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > 93) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Occupancy window cannot exceed 93 days");
        }
        Town town = null;
        if (townId != null) {
            town = townRepository.findById(townId)
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Town not found"));
        }
        List<AdInvoice> rows = invoiceRepository.findActiveInRange(from, to, slot, ACTIVE);
        List<AdOccupancyBookingDto> bookings = new ArrayList<>();
        for (AdInvoice row : rows) {
            if (townId != null && !townsOverlap(row.isAllTowns() ? AdTownScope.ALL_TOWNS : row.getTownScope(),
                    Set.of(townId), row)) {
                continue;
            }
            bookings.add(toOccupancyBooking(row));
        }
        return AdOccupancyResponse.builder()
                .fromDate(from)
                .toDate(to)
                .townId(townId)
                .townName(town == null ? null : town.getDisplayName())
                .bookings(bookings)
                .build();
    }

    private List<AdInvoiceConflictDto> findConflicts(
            TownAdSlot slot,
            int slotIndex,
            LocalDate from,
            LocalDate to,
            AdTownScope scope,
            List<UUID> townIds,
            UUID ignoreInvoiceId) {
        List<AdInvoice> rows = invoiceRepository.findOverlapping(slot, slotIndex, from, to, ACTIVE);
        Set<UUID> wanted = new HashSet<>(townIds);
        List<AdInvoiceConflictDto> out = new ArrayList<>();
        for (AdInvoice row : rows) {
            if (ignoreInvoiceId != null && ignoreInvoiceId.equals(row.getId())) {
                continue;
            }
            if (!townsOverlap(scope, wanted, row)) {
                continue;
            }
            out.add(AdInvoiceConflictDto.builder()
                    .invoiceId(row.getId())
                    .invoiceNumber(row.getInvoiceNumber())
                    .advertiserName(row.getAdvertiserName())
                    .fromDate(row.getFromDate().toString())
                    .toDate(row.getToDate().toString())
                    .status(row.getStatus().name())
                    .slotLabel(slotLabel(row.getSlot(), row.getSlotIndex()))
                    .allTowns(row.isAllTowns())
                    .bookingPhase(bookingPhase(row.getFromDate(), row.getToDate()))
                    .build());
        }
        return out;
    }

    private boolean townsOverlap(AdTownScope scope, Set<UUID> townIds, AdInvoice other) {
        if (scope == AdTownScope.ALL_TOWNS || other.isAllTowns() || other.getTownScope() == AdTownScope.ALL_TOWNS) {
            return true;
        }
        Set<UUID> theirs = new HashSet<>(readTownIds(other));
        if (townIds.isEmpty() || theirs.isEmpty()) {
            return true;
        }
        for (UUID id : townIds) {
            if (theirs.contains(id)) {
                return true;
            }
        }
        return false;
    }

    private List<UUID> normalizeTownIds(AdTownScope scope, List<UUID> raw) {
        if (scope == AdTownScope.ALL_TOWNS) {
            return List.of();
        }
        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        if (raw != null) {
            for (UUID id : raw) {
                if (id != null) {
                    ids.add(id);
                }
            }
        }
        if (scope == AdTownScope.ONE_TOWN && ids.size() != 1) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Pick exactly one town for a one-town ad");
        }
        if (scope == AdTownScope.MULTI_TOWN && ids.size() < 2) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Pick at least two towns for a multi-town ad");
        }
        if (ids.size() > MAX_TOWNS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Too many towns (max " + MAX_TOWNS + ")");
        }
        List<Town> found = townRepository.findByIdIn(ids);
        if (found.size() != ids.size()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "One or more selected towns were not found");
        }
        return List.copyOf(ids);
    }

    private List<AdInvoiceTownDto> townsFor(AdTownScope scope, List<UUID> townIds) {
        if (scope == AdTownScope.ALL_TOWNS) {
            return List.of();
        }
        Map<UUID, Town> byId = townRepository.findByIdIn(townIds).stream()
                .collect(Collectors.toMap(Town::getId, t -> t));
        List<AdInvoiceTownDto> out = new ArrayList<>();
        for (UUID id : townIds) {
            Town t = byId.get(id);
            if (t == null) {
                continue;
            }
            out.add(AdInvoiceTownDto.builder()
                    .id(t.getId())
                    .name(t.getDisplayName())
                    .townCode(t.getTownCode())
                    .build());
        }
        return out;
    }

    private AdRateCard loadOrCreateCard() {
        return rateCardRepository.findById(AdRateCard.SINGLETON_ID).orElseGet(() -> {
            AdRateCard card = AdRateCard.builder()
                    .id(AdRateCard.SINGLETON_ID)
                    .taxPercent(BigDecimal.ZERO)
                    .notes("Default ad rate card")
                    .ratesJson(writeJson(defaultRates()))
                    .build();
            return rateCardRepository.save(card);
        });
    }

    private AdRatesDocument readRates(AdRateCard card) {
        try {
            AdRatesDocument doc = objectMapper.readValue(card.getRatesJson(), AdRatesDocument.class);
            AdRatesDocument fallback = defaultRates();
            if (doc.getHomeHero() == null) {
                doc.setHomeHero(fallback.getHomeHero());
            }
            if (doc.getHomeMidGrid() == null) {
                doc.setHomeMidGrid(fallback.getHomeMidGrid());
            }
            if (doc.getCartUpsell() == null) {
                doc.setCartUpsell(fallback.getCartUpsell());
            }
            fillMissingYear(doc.getHomeHero(), fallback.getHomeHero());
            fillMissingYear(doc.getHomeMidGrid(), fallback.getHomeMidGrid());
            fillMissingYear(doc.getCartUpsell(), fallback.getCartUpsell());
            return doc;
        } catch (Exception ex) {
            return defaultRates();
        }
    }

    private AdRateCardResponse toRateCardResponse(AdRateCard card) {
        AdRatesDocument doc = readRates(card);
        return AdRateCardResponse.builder()
                .id(card.getId())
                .taxPercent(money(nz(card.getTaxPercent())))
                .notes(card.getNotes())
                .homeHero(copySlot(doc.getHomeHero()))
                .homeMidGrid(copySlot(doc.getHomeMidGrid()))
                .cartUpsell(copySlot(doc.getCartUpsell()))
                .build();
    }

    private AdInvoiceResponse toInvoiceResponse(AdInvoice invoice) {
        List<UUID> townIds = readTownIds(invoice);
        AdTownScope scope = invoice.getTownScope();
        List<AdInvoiceTownDto> towns = townsFor(scope, townIds);
        int townCount = invoice.isAllTowns()
                ? (int) townRepository.findByStatusOrderByDisplayNameAsc(TownStatus.ENABLED).size()
                : townIds.size();
        BigDecimal unitRate = switch (scope) {
            case ONE_TOWN -> invoice.getUnitOneTown();
            case MULTI_TOWN -> money(invoice.getUnitOneTown()
                    .add(invoice.getUnitExtraTown().multiply(BigDecimal.valueOf(Math.max(townCount - 1, 0)))));
            case ALL_TOWNS -> invoice.getUnitAllTowns();
        };
        return AdInvoiceResponse.builder()
                .id(invoice.getId())
                .invoiceNumber(invoice.getInvoiceNumber())
                .status(invoice.getStatus())
                .advertiserName(invoice.getAdvertiserName())
                .advertiserPhone(invoice.getAdvertiserPhone())
                .advertiserGstin(invoice.getAdvertiserGstin())
                .notes(invoice.getNotes())
                .slot(invoice.getSlot())
                .slotIndex(invoice.getSlotIndex())
                .slotLabel(slotLabel(invoice.getSlot(), invoice.getSlotIndex()))
                .period(invoice.getPeriod())
                .townScope(scope)
                .allTowns(invoice.isAllTowns())
                .townIds(townIds)
                .towns(towns)
                .townCount(Math.max(townCount, 1))
                .fromDate(invoice.getFromDate())
                .toDate(invoice.getToDate())
                .calendarDays(invoice.getCalendarDays())
                .billableUnits(invoice.getBillableUnits())
                .unitOneTown(invoice.getUnitOneTown())
                .unitExtraTown(invoice.getUnitExtraTown())
                .unitAllTowns(invoice.getUnitAllTowns())
                .unitRate(unitRate)
                .taxPercent(invoice.getTaxPercent())
                .subtotal(invoice.getSubtotal())
                .taxAmount(invoice.getTaxAmount())
                .total(invoice.getTotal())
                .breakdown(breakdown(
                        scope,
                        invoice.getSlot(),
                        invoice.getSlotIndex(),
                        invoice.getPeriod(),
                        invoice.getCalendarDays(),
                        invoice.getBillableUnits(),
                        Math.max(townCount, 1),
                        unitRate,
                        invoice.getSubtotal(),
                        invoice.getTaxPercent(),
                        invoice.getTaxAmount()))
                .paidAt(invoice.getPaidAt())
                .paidMethod(invoice.getPaidMethod())
                .paidReference(invoice.getPaidReference())
                .voidedAt(invoice.getVoidedAt())
                .voidReason(invoice.getVoidReason())
                .issuedAt(invoice.getIssuedAt())
                .issuedBy(invoice.getIssuedBy())
                .bookingPhase(bookingPhase(invoice.getFromDate(), invoice.getToDate()))
                .build();
    }

    private AdInvoice requireInvoice(UUID id) {
        return invoiceRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Invoice not found"));
    }

    private synchronized String nextInvoiceNumber() {
        String prefix = "ADS/" + LocalDate.now(IST).format(INVOICE_DAY) + "-";
        List<String> latest = invoiceRepository.findNumbersForPrefix(prefix, PageRequest.of(0, 1));
        int seq = 1;
        if (!latest.isEmpty()) {
            String last = latest.get(0);
            int dash = last.lastIndexOf('-');
            if (dash >= 0 && dash < last.length() - 1) {
                try {
                    seq = Integer.parseInt(last.substring(dash + 1)) + 1;
                } catch (NumberFormatException ignored) {
                    seq = 1;
                }
            }
        }
        if (seq > 9999) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Daily invoice sequence exhausted");
        }
        String number = prefix + String.format("%04d", seq);
        if (invoiceRepository.findByInvoiceNumber(number).isPresent()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Could not allocate invoice number, try again");
        }
        return number;
    }

    private static Specification<AdInvoice> invoiceFilter(
            AdInvoiceStatus status,
            TownAdSlot slot,
            String q,
            LocalDate from,
            LocalDate to) {
        return (root, query, cb) -> {
            List<Predicate> parts = new ArrayList<>();
            if (status != null) {
                parts.add(cb.equal(root.get("status"), status));
            }
            if (slot != null) {
                parts.add(cb.equal(root.get("slot"), slot));
            }
            if (from != null) {
                parts.add(cb.greaterThanOrEqualTo(root.get("toDate"), from));
            }
            if (to != null) {
                parts.add(cb.lessThanOrEqualTo(root.get("fromDate"), to));
            }
            if (StringUtils.hasText(q)) {
                String like = "%" + q.trim().toLowerCase(Locale.ROOT) + "%";
                parts.add(cb.or(
                        cb.like(cb.lower(root.get("invoiceNumber")), like),
                        cb.like(cb.lower(root.get("advertiserName")), like),
                        cb.like(cb.lower(root.get("advertiserPhone")), like),
                        cb.like(cb.lower(cb.coalesce(root.get("paidReference"), "")), like)));
            }
            return cb.and(parts.toArray(Predicate[]::new));
        };
    }

    private AdSlotRateDto requireSlotRates(String label, AdSlotRateDto slot) {
        if (slot == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " rates are required");
        }
        return AdSlotRateDto.builder()
                .day(requirePeriod(label + " / day", slot.getDay()))
                .week(requirePeriod(label + " / week", slot.getWeek()))
                .month(requirePeriod(label + " / month", slot.getMonth()))
                .year(requirePeriod(label + " / year", slot.getYear()))
                .build();
    }

    private AdPeriodRateDto requirePeriod(String label, AdPeriodRateDto rates) {
        if (rates == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " rates are required");
        }
        BigDecimal one = money(nz(rates.getOneTown()));
        BigDecimal extra = money(nz(rates.getExtraTown()));
        BigDecimal all = money(nz(rates.getAllTowns()));
        if (one.compareTo(BigDecimal.ZERO) < 0 || extra.compareTo(BigDecimal.ZERO) < 0 || all.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " amounts cannot be negative");
        }
        if (one.compareTo(new BigDecimal("10000000")) > 0
                || extra.compareTo(new BigDecimal("10000000")) > 0
                || all.compareTo(new BigDecimal("10000000")) > 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " amount is too large");
        }
        return AdPeriodRateDto.builder().oneTown(one).extraTown(extra).allTowns(all).build();
    }

    private static AdSlotRateDto slotRates(AdRatesDocument doc, TownAdSlot slot) {
        return switch (slot) {
            case HOME_HERO -> doc.getHomeHero();
            case HOME_MID_GRID -> doc.getHomeMidGrid();
            case CART_UPSELL -> doc.getCartUpsell();
        };
    }

    private static AdPeriodRateDto periodRates(AdSlotRateDto slot, AdBillPeriod period) {
        if (slot == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rate card is missing this ad slot");
        }
        AdPeriodRateDto rates = switch (period) {
            case DAY -> slot.getDay();
            case WEEK -> slot.getWeek();
            case MONTH -> slot.getMonth();
            case YEAR -> slot.getYear();
        };
        if (rates == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rate card is missing " + period.name().toLowerCase() + " prices");
        }
        return rates;
    }

    private static AdSlotRateDto copySlot(AdSlotRateDto slot) {
        if (slot == null) {
            return zeroSlot();
        }
        return AdSlotRateDto.builder()
                .day(copyPeriod(slot.getDay()))
                .week(copyPeriod(slot.getWeek()))
                .month(copyPeriod(slot.getMonth()))
                .year(copyPeriod(slot.getYear()))
                .build();
    }

    private static AdPeriodRateDto copyPeriod(AdPeriodRateDto p) {
        if (p == null) {
            return AdPeriodRateDto.builder()
                    .oneTown(BigDecimal.ZERO)
                    .extraTown(BigDecimal.ZERO)
                    .allTowns(BigDecimal.ZERO)
                    .build();
        }
        return AdPeriodRateDto.builder()
                .oneTown(money(nz(p.getOneTown())))
                .extraTown(money(nz(p.getExtraTown())))
                .allTowns(money(nz(p.getAllTowns())))
                .build();
    }

    private static AdRatesDocument defaultRates() {
        return AdRatesDocument.builder()
                .homeHero(slot(800, 350, 8000, 4500, 1800, 40000, 15000, 5000, 120000, 150000, 50000, 1200000))
                .homeMidGrid(slot(400, 180, 4000, 2200, 900, 20000, 7500, 2500, 60000, 75000, 25000, 600000))
                .cartUpsell(slot(500, 220, 5000, 2800, 1100, 25000, 9000, 3200, 75000, 90000, 32000, 750000))
                .build();
    }

    private static AdSlotRateDto slot(
            int d1, int d2, int d3, int w1, int w2, int w3, int m1, int m2, int m3, int y1, int y2, int y3) {
        return AdSlotRateDto.builder()
                .day(period(d1, d2, d3))
                .week(period(w1, w2, w3))
                .month(period(m1, m2, m3))
                .year(period(y1, y2, y3))
                .build();
    }

    private static AdPeriodRateDto period(int one, int extra, int all) {
        return AdPeriodRateDto.builder()
                .oneTown(BigDecimal.valueOf(one))
                .extraTown(BigDecimal.valueOf(extra))
                .allTowns(BigDecimal.valueOf(all))
                .build();
    }

    private static AdSlotRateDto zeroSlot() {
        return AdSlotRateDto.builder()
                .day(period(0, 0, 0))
                .week(period(0, 0, 0))
                .month(period(0, 0, 0))
                .year(period(0, 0, 0))
                .build();
    }

    private static void fillMissingYear(AdSlotRateDto slot, AdSlotRateDto fallback) {
        if (slot != null && slot.getYear() == null && fallback != null) {
            slot.setYear(fallback.getYear());
        }
    }

    private static int normalizeSlotIndex(TownAdSlot slot, Integer slotIndex) {
        if (slot == TownAdSlot.HOME_MID_GRID) {
            int idx = slotIndex == null ? 1 : slotIndex;
            if (idx < 1 || idx > MID_GRID_SLOTS) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Mid-grid slide must be between 1 and " + MID_GRID_SLOTS);
            }
            return idx;
        }
        return 0;
    }

    private record DateWindow(LocalDate from, LocalDate to) {
    }

    private DateWindow nextFreeWindow(
            TownAdSlot slot,
            int slotIndex,
            AdTownScope scope,
            List<UUID> townIds,
            int durationDays,
            LocalDate searchFrom,
            UUID ignoreInvoiceId) {
        if (durationDays < 1) {
            return null;
        }
        LocalDate start = searchFrom;
        LocalDate limit = LocalDate.now(IST).plusDays(MAX_DAYS);
        int guard = 0;
        while (!start.plusDays(durationDays - 1L).isAfter(limit) && guard++ < 800) {
            LocalDate end = start.plusDays(durationDays - 1L);
            List<AdInvoiceConflictDto> conflicts = findConflicts(slot, slotIndex, start, end, scope, townIds, ignoreInvoiceId);
            if (conflicts.isEmpty()) {
                return new DateWindow(start, end);
            }
            LocalDate jump = start.plusDays(1);
            for (AdInvoiceConflictDto conflict : conflicts) {
                LocalDate conflictEnd = LocalDate.parse(conflict.getToDate()).plusDays(1);
                if (conflictEnd.isAfter(jump)) {
                    jump = conflictEnd;
                }
            }
            start = jump;
        }
        return null;
    }

    private AdOccupancyBookingDto toOccupancyBooking(AdInvoice row) {
        List<UUID> townIds = readTownIds(row);
        return AdOccupancyBookingDto.builder()
                .invoiceId(row.getId())
                .invoiceNumber(row.getInvoiceNumber())
                .advertiserName(row.getAdvertiserName())
                .status(row.getStatus())
                .slot(row.getSlot())
                .slotIndex(row.getSlotIndex())
                .slotLabel(slotLabel(row.getSlot(), row.getSlotIndex()))
                .fromDate(row.getFromDate())
                .toDate(row.getToDate())
                .allTowns(row.isAllTowns())
                .towns(townsFor(row.isAllTowns() ? AdTownScope.ALL_TOWNS : row.getTownScope(), townIds))
                .bookingPhase(bookingPhase(row.getFromDate(), row.getToDate()))
                .build();
    }

    static String bookingPhase(LocalDate from, LocalDate to) {
        LocalDate today = LocalDate.now(IST);
        if (to.isBefore(today)) {
            return "ENDED";
        }
        if (from.isAfter(today)) {
            return "PREORDER";
        }
        return "LIVE";
    }

    static String slotLabel(TownAdSlot slot, int slotIndex) {
        return switch (slot) {
            case HOME_HERO -> "Main ad (home strip)";
            case HOME_MID_GRID -> "Mid-grid slide " + slotIndex;
            case CART_UPSELL -> "Cart ad";
        };
    }

    private static String breakdown(
            AdTownScope scope,
            TownAdSlot slot,
            int slotIndex,
            AdBillPeriod period,
            long days,
            int units,
            int townCount,
            BigDecimal unitRate,
            BigDecimal subtotal,
            BigDecimal taxPercent,
            BigDecimal taxAmount) {
        String periodWord = switch (period) {
            case DAY -> units == 1 ? "day" : "days";
            case WEEK -> units == 1 ? "week" : "weeks";
            case MONTH -> units == 1 ? "month" : "months";
            case YEAR -> units == 1 ? "year" : "years";
        };
        String towns = switch (scope) {
            case ONE_TOWN -> "1 town";
            case MULTI_TOWN -> townCount + " towns";
            case ALL_TOWNS -> "all towns";
        };
        String tax = taxAmount.compareTo(BigDecimal.ZERO) > 0
                ? " + GST " + taxPercent.stripTrailingZeros().toPlainString() + "% ₹" + taxAmount.toPlainString()
                : "";
        return slotLabel(slot, slotIndex) + " · " + days + " calendar day" + (days == 1 ? "" : "s")
                + " billed as " + units + " " + periodWord + " · " + towns
                + " · ₹" + unitRate.toPlainString() + " × " + units
                + " = ₹" + subtotal.toPlainString() + tax;
    }

    private List<UUID> readTownIds(AdInvoice invoice) {
        try {
            List<UUID> ids = objectMapper.readValue(invoice.getTownIdsJson(), UUID_LIST);
            return ids == null ? List.of() : ids;
        } catch (Exception ex) {
            return List.of();
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not store ad billing data");
        }
    }

    private static UUID primaryTownId(List<UUID> townIds) {
        return townIds == null || townIds.isEmpty() ? null : townIds.get(0);
    }

    private static String normalizePhone(String raw) {
        String digits = raw == null ? "" : raw.replaceAll("\\D", "");
        if (digits.length() == 12 && digits.startsWith("91")) {
            digits = digits.substring(2);
        }
        if (digits.length() == 11 && digits.startsWith("0")) {
            digits = digits.substring(1);
        }
        if (!PHONE.matcher(digits).matches()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Enter a valid 10-digit mobile number");
        }
        return digits;
    }

    private static String normalizeGstin(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String gstin = raw.trim().toUpperCase(Locale.ROOT).replace(" ", "");
        if (!GSTIN.matcher(gstin).matches()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "GSTIN must be 15 characters if provided");
        }
        return gstin;
    }

    private static String trimRequired(String raw, int max, String label) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() < 2) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " is required");
        }
        if (value.length() > max) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " is too long");
        }
        return value;
    }

    private static String trimTo(String value, int max) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static BigDecimal money(BigDecimal value) {
        return nz(value).setScale(2, RoundingMode.HALF_UP);
    }
}
