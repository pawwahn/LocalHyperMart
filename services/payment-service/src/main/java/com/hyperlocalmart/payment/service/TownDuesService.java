package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.client.TownClient;
import com.hyperlocalmart.payment.dto.response.TownDuesResponse;
import com.hyperlocalmart.payment.entity.HubPaymentRequest;
import com.hyperlocalmart.payment.entity.HubPaymentRequestStatus;
import com.hyperlocalmart.payment.entity.HubPaymentRequestType;
import com.hyperlocalmart.payment.entity.Settlement;
import com.hyperlocalmart.payment.entity.SettlementDirection;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import com.hyperlocalmart.payment.repository.CodCloseDayLineItemRepository;
import com.hyperlocalmart.payment.repository.CodCloseDayRepository;
import com.hyperlocalmart.payment.repository.CodHubPlatformRemittanceRepository;
import com.hyperlocalmart.payment.repository.HubPaymentRequestRepository;
import com.hyperlocalmart.payment.repository.HubPlatformPaymentSubmissionLineRepository;
import com.hyperlocalmart.payment.repository.SettlementRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Date;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class TownDuesService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.ENGLISH);
    private static final List<HubPaymentRequestStatus> OPEN_BILLS = List.of(
            HubPaymentRequestStatus.ISSUED,
            HubPaymentRequestStatus.PAYMENT_PENDING);
    private static final List<HubPaymentRequestStatus> FRANCHISE_DONE = List.of(
            HubPaymentRequestStatus.ISSUED,
            HubPaymentRequestStatus.PAYMENT_PENDING,
            HubPaymentRequestStatus.APPROVED);
    /** A franchise month already has a settlement, including one paid without a hub bill. */
    private static final List<SettlementStatus> FRANCHISE_SETTLED = List.of(
            SettlementStatus.DRAFT,
            SettlementStatus.FINALIZED,
            SettlementStatus.PAID);
    private static final int MAX_FRANCHISE_MONTHS = 12;

    private final CodCloseDayLineItemRepository closeLineRepository;
    private final CodCloseDayRepository closeDayRepository;
    private final CodHubPlatformRemittanceRepository remittanceRepository;
    private final HubPaymentRequestRepository requestRepository;
    private final HubPlatformPaymentSubmissionLineRepository submissionLineRepository;
    private final SettlementRepository settlementRepository;
    private final TownClient townClient;
    private final OpenAccountsService openAccountsService;

    @Transactional(readOnly = true)
    public TownDuesResponse dues(LocalDate from, LocalDate to) {
        List<Draft> drafts = new ArrayList<>();
        drafts.addAll(unbilledCod(from, to));
        drafts.addAll(openHubBills(from, to));
        drafts.addAll(openSettlements(from, to));
        drafts.addAll(unbilledFranchise(from, to));
        try {
            for (OpenAccountsService.Line open : openAccountsService.scan(from, to)) {
                drafts.add(new Draft(
                        open.townId(),
                        open.party(),
                        open.partyId(),
                        open.partyName(),
                        open.action(),
                        open.what(),
                        open.periodStart(),
                        open.periodEnd(),
                        open.amount(),
                        open.itemCount(),
                        open.reference(),
                        open.detail(),
                        open.commission(),
                        null,
                        null,
                        null,
                        null));
            }
        } catch (RuntimeException ex) {
            log.warn("Open accounts scan failed: {}", ex.toString());
        }

        Map<UUID, List<Draft>> byTown = new HashMap<>();
        for (Draft draft : drafts) {
            byTown.computeIfAbsent(draft.townId(), k -> new ArrayList<>()).add(draft);
        }

        List<TownDuesResponse.Town> towns = new ArrayList<>();
        for (Map.Entry<UUID, List<Draft>> entry : byTown.entrySet()) {
            List<Draft> lines = entry.getValue();
            lines.sort(Comparator
                    .comparingInt((Draft d) -> actionRank(d.action()))
                    .thenComparing(Draft::party)
                    .thenComparing(d -> d.partyName() == null ? "" : d.partyName())
                    .thenComparing(Draft::periodStart, Comparator.nullsLast(Comparator.naturalOrder())));
            towns.add(TownDuesResponse.Town.builder()
                    .townId(entry.getKey())
                    .sendBill(sum(lines, "SEND_BILL"))
                    .collect(sum(lines, "COLLECT"))
                    .pay(sum(lines, "PAY"))
                    .confirm(sum(lines, "CONFIRM"))
                    .lines(lines.stream().map(Draft::toLine).toList())
                    .build());
        }
        towns.sort(Comparator.comparing((TownDuesResponse.Town t) ->
                t.getSendBill().add(t.getCollect()).add(t.getPay()).add(t.getConfirm())).reversed());

        return TownDuesResponse.builder()
                .from(from)
                .to(to)
                .sendBill(towns.stream().map(TownDuesResponse.Town::getSendBill).reduce(BigDecimal.ZERO, BigDecimal::add))
                .collect(towns.stream().map(TownDuesResponse.Town::getCollect).reduce(BigDecimal.ZERO, BigDecimal::add))
                .pay(towns.stream().map(TownDuesResponse.Town::getPay).reduce(BigDecimal.ZERO, BigDecimal::add))
                .confirm(towns.stream().map(TownDuesResponse.Town::getConfirm).reduce(BigDecimal.ZERO, BigDecimal::add))
                .townCount(towns.size())
                .towns(towns)
                .build();
    }

    private List<Draft> unbilledCod(LocalDate from, LocalDate to) {
        List<Object[]> rows = from == null || to == null
                ? closeLineRepository.unbilledHubCod()
                : closeLineRepository.unbilledHubCodBetween(from, to);
        Map<String, BigDecimal> stillOwed = hubCodStillOwed();
        List<Draft> out = new ArrayList<>();
        for (Object[] row : rows) {
            UUID townId = uuid(row[0]);
            UUID hubId = uuid(row[1]);
            BigDecimal unbilled = money(row[3]);
            if (unbilled.signum() <= 0) continue;
            // Cash already confirmed to KoyaKart is no longer at the hub, even when no bill was issued.
            BigDecimal owed = stillOwed.getOrDefault(hubKey(townId, hubId), BigDecimal.ZERO);
            BigDecimal amount = unbilled.min(owed);
            if (amount.signum() <= 0) continue;
            int count = amount.compareTo(unbilled) == 0 ? ((Number) row[2]).intValue() : 0;
            out.add(new Draft(
                    townId,
                    "HUB",
                    hubId,
                    null,
                    "SEND_BILL",
                    "COD cash at the hub, not on a bill yet",
                    date(row[4]),
                    date(row[5]),
                    amount,
                    count,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null,
                    null));
        }
        return out;
    }

    /** Ledger balance: hub close-day cash minus remittances KoyaKart already confirmed. */
    private Map<String, BigDecimal> hubCodStillOwed() {
        Map<String, BigDecimal> owed = new HashMap<>();
        for (Object[] row : closeDayRepository.sumReceivedGroupedByHub()) {
            owed.put(hubKey(uuid(row[0]), uuid(row[1])), money(row[2]));
        }
        for (Object[] row : remittanceRepository.sumAmountGroupedByHub()) {
            String key = hubKey(uuid(row[0]), uuid(row[1]));
            BigDecimal left = owed.getOrDefault(key, BigDecimal.ZERO).subtract(money(row[2]));
            if (left.signum() < 0) {
                left = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
            }
            owed.put(key, left);
        }
        return owed;
    }

    private List<Draft> openHubBills(LocalDate from, LocalDate to) {
        List<Draft> out = new ArrayList<>();
        List<HubPaymentRequest> rows = from == null || to == null
                ? requestRepository.findByStatusInOrderByPeriodStartAsc(OPEN_BILLS)
                : requestRepository.findOpenForDuesBetween(OPEN_BILLS, from, to);
        for (HubPaymentRequest row : rows) {
            boolean confirm = row.getStatus() == HubPaymentRequestStatus.PAYMENT_PENDING;
            boolean franchise = row.getRequestType() == HubPaymentRequestType.FRANCHISE;
            String what = franchise
                    ? (confirm ? "Franchise payment sent — confirm it" : "Franchise bill sent — collect it")
                    : (confirm ? "COD payment sent — confirm it" : "COD bill sent — collect it");
            out.add(new Draft(
                    row.getTownId(),
                    "HUB",
                    row.getHubId(),
                    null,
                    confirm ? "CONFIRM" : "COLLECT",
                    what,
                    row.getPeriodStart(),
                    row.getPeriodEnd(),
                    money(row.getTotalAmount()),
                    1,
                    row.getDocumentNumber(),
                    null,
                    null,
                    null,
                    confirm ? row.getSubmissionId() : null,
                    null,
                    null));
        }
        return out;
    }

    private List<Draft> openSettlements(LocalDate from, LocalDate to) {
        List<Draft> out = new ArrayList<>();
        List<Settlement> rows = from == null || to == null
                ? settlementRepository.findByStatusNotOrderByPeriodStartAsc(SettlementStatus.PAID)
                : settlementRepository.findOpenForDuesBetween(from, to);
        for (Settlement row : rows) {
            String party = switch (row.getPayeeType()) {
                case VENDOR -> "VENDOR";
                case HUB -> "HUB";
                case AGENT -> "AGENT";
            };
            boolean collection = row.getDirection() == SettlementDirection.COLLECTION;
            String action;
            String what;
            if (!collection) {
                action = "PAY";
                what = switch (row.getPayeeType()) {
                    case VENDOR -> "Vendor goods payout";
                    case HUB -> "Hub commission payout";
                    case AGENT -> "Delivery agent payout";
                };
            } else if (row.getVendorPaidAt() != null) {
                action = "CONFIRM";
                what = row.getPayeeType() == SettlementPayeeType.VENDOR
                        ? "Vendor says this bill is paid — confirm it"
                        : "Payment sent — confirm it";
            } else if (row.getBillSentAt() == null) {
                action = "SEND_BILL";
                what = row.getPayeeType() == SettlementPayeeType.VENDOR
                        ? "Vendor bill not sent"
                        : "Bill not sent";
            } else {
                action = "COLLECT";
                what = row.getPayeeType() == SettlementPayeeType.VENDOR
                        ? "Vendor bill sent — collect it"
                        : "Bill sent — collect it";
            }
            out.add(new Draft(
                    row.getTownId(),
                    party,
                    row.getPayeeId(),
                    row.getPayeeName(),
                    action,
                    what,
                    row.getPeriodStart(),
                    row.getPeriodEnd(),
                    money(row.getNetAmount()),
                    1,
                    row.getServiceInvoiceNumber(),
                    null,
                    vendorCommission(row, party),
                    "CONFIRM".equals(action) || "PAY".equals(action) ? row.getId() : null,
                    null,
                    row.getVendorPaymentMethod(),
                    row.getVendorPaymentReference()));
        }
        return out;
    }

    private List<Draft> unbilledFranchise(LocalDate from, LocalDate to) {
        List<YearMonth> months = franchiseMonths(from, to);
        if (months.isEmpty()) return List.of();
        Map<UUID, List<UUID>> hubsByTown = new HashMap<>();
        for (Object[] row : closeLineRepository.distinctHubTowns()) {
            UUID townId = uuid(row[0]);
            UUID hubId = uuid(row[1]);
            if (townId == null || hubId == null) continue;
            hubsByTown.computeIfAbsent(townId, k -> new ArrayList<>());
            if (!hubsByTown.get(townId).contains(hubId)) hubsByTown.get(townId).add(hubId);
        }
        Set<String> billed = billedFranchiseKeys(months);
        List<Draft> out = new ArrayList<>();
        for (Map.Entry<UUID, List<UUID>> entry : hubsByTown.entrySet()) {
            TownClient.DeliveryPayoutConfig config;
            try {
                config = townClient.deliveryPayoutConfig(entry.getKey());
            } catch (RuntimeException ex) {
                log.warn("Franchise terms unavailable for town {}", entry.getKey());
                continue;
            }
            TownClient.DeliveryPayoutConfig.Franchise franchise = config == null || config.hub() == null
                    ? null
                    : config.hub().franchise();
            if (franchise == null || !franchise.enabled() || franchise.amount() == null
                    || franchise.amount().signum() <= 0) {
                continue;
            }
            LocalDate billingStart = parseDate(franchise.effectiveFrom());
            if (billingStart == null) continue;
            YearMonth startMonth = YearMonth.from(billingStart);
            for (UUID hubId : entry.getValue()) {
                for (YearMonth month : months) {
                    if (month.isBefore(startMonth)) continue;
                    LocalDate start = month.atDay(1);
                    LocalDate end = month.atEndOfMonth();
                    if (billed.contains(hubId + "|" + start)) continue;
                    out.add(new Draft(
                            entry.getKey(),
                            "HUB",
                            hubId,
                            null,
                            "SEND_BILL",
                            "Franchise " + month.format(MONTH) + " — send the bill",
                            start,
                            end,
                            money(franchise.amount()),
                            1,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null,
                            null));
                }
            }
        }
        return out;
    }

    private Set<String> billedFranchiseKeys(List<YearMonth> months) {
        LocalDate from = months.get(0).atDay(1);
        LocalDate to = months.get(months.size() - 1).atEndOfMonth();
        Set<String> keys = new HashSet<>();
        for (HubPaymentRequest row : requestRepository.findOpenForDuesBetween(FRANCHISE_DONE, from, to)) {
            if (row.getRequestType() != HubPaymentRequestType.FRANCHISE || row.getPeriodStart() == null) continue;
            keys.add(row.getHubId() + "|" + row.getPeriodStart());
        }
        for (Object[] row : settlementRepository.findHubFranchisePeriodStarts(from, to, FRANCHISE_SETTLED)) {
            addFranchiseKey(keys, uuid(row[0]), date(row[1]));
        }
        for (Object[] row : submissionLineRepository.findVerifiedFranchisePeriodStarts(from, to)) {
            addFranchiseKey(keys, uuid(row[0]), date(row[1]));
        }
        return keys;
    }

    private static void addFranchiseKey(Set<String> keys, UUID hubId, LocalDate periodStart) {
        if (hubId == null || periodStart == null) return;
        keys.add(hubId + "|" + periodStart);
    }

    private static String hubKey(UUID townId, UUID hubId) {
        return townId + "|" + hubId;
    }

    private static List<YearMonth> franchiseMonths(LocalDate from, LocalDate to) {
        YearMonth start = from == null ? YearMonth.now(IST) : YearMonth.from(from);
        YearMonth end = to == null ? YearMonth.now(IST) : YearMonth.from(to);
        if (end.isBefore(start)) {
            YearMonth swap = start;
            start = end;
            end = swap;
        }
        List<YearMonth> months = new ArrayList<>();
        for (YearMonth cursor = start; !cursor.isAfter(end); cursor = cursor.plusMonths(1)) {
            months.add(cursor);
            if (months.size() > MAX_FRANCHISE_MONTHS) months.remove(0);
        }
        return months;
    }

    /** Order-fee commission. Subscription bills store the fee in the same column with zero gross. */
    private static BigDecimal vendorCommission(Settlement row, String party) {
        if (!"VENDOR".equals(party)) {
            return null;
        }
        boolean subscription = row.getDirection() == SettlementDirection.COLLECTION
                && (row.getGrossAmount() == null || row.getGrossAmount().signum() == 0);
        if (subscription) {
            return null;
        }
        return money(row.getCommissionAmount());
    }

    private static BigDecimal sum(List<Draft> lines, String action) {
        return lines.stream()
                .filter(line -> action.equals(line.action()))
                .map(Draft::amount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static int actionRank(String action) {
        return switch (action) {
            case "SEND_BILL" -> 0;
            case "COLLECT" -> 1;
            case "CONFIRM" -> 2;
            default -> 3;
        };
    }

    private static BigDecimal money(Object raw) {
        if (raw == null) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        if (raw instanceof BigDecimal decimal) return decimal.setScale(2, RoundingMode.HALF_UP);
        if (raw instanceof Number number) {
            return BigDecimal.valueOf(number.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        }
        return new BigDecimal(raw.toString()).setScale(2, RoundingMode.HALF_UP);
    }

    private static UUID uuid(Object raw) {
        if (raw == null) return null;
        if (raw instanceof UUID id) return id;
        return UUID.fromString(raw.toString());
    }

    private static LocalDate date(Object raw) {
        if (raw == null) return null;
        if (raw instanceof LocalDate local) return local;
        if (raw instanceof Date sql) return sql.toLocalDate();
        return LocalDate.parse(raw.toString());
    }

    private static LocalDate parseDate(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return LocalDate.parse(raw.trim().substring(0, 10));
        } catch (RuntimeException ex) {
            return null;
        }
    }

    private record Draft(
            UUID townId,
            String party,
            UUID partyId,
            String partyName,
            String action,
            String what,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal amount,
            int itemCount,
            String reference,
            String detail,
            BigDecimal commission,
            UUID settlementId,
            UUID submissionId,
            String paymentMethod,
            String paymentReference) {
        TownDuesResponse.Line toLine() {
            return TownDuesResponse.Line.builder()
                    .party(party)
                    .partyId(partyId)
                    .partyName(partyName)
                    .action(action)
                    .what(what)
                    .detail(detail)
                    .periodStart(periodStart)
                    .periodEnd(periodEnd)
                    .amount(amount)
                    .commission(commission)
                    .itemCount(itemCount)
                    .reference(reference)
                    .settlementId(settlementId)
                    .submissionId(submissionId)
                    .paymentMethod(paymentMethod)
                    .paymentReference(paymentReference)
                    .build();
        }
    }
}
