package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.beauty.BeautySlotBlocks;
import com.hyperlocalmart.common.beauty.BeautySlotSchedule;
import com.hyperlocalmart.common.beauty.BeautyStaffOverrides;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.beauty.BeautyServiceCatalog;
import com.hyperlocalmart.vendor.entity.BeautyVendorTreatment;
import com.hyperlocalmart.vendor.dto.request.UpsertBeautyOpsRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertBeautyProfileRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertBeautyRatesRequest;
import com.hyperlocalmart.vendor.dto.response.BeautyArtistResponse;
import com.hyperlocalmart.vendor.entity.BeautyProfile;
import com.hyperlocalmart.vendor.entity.BeautyRate;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.entity.VendorStatus;
import com.hyperlocalmart.vendor.entity.ServiceOffering;
import com.hyperlocalmart.vendor.repository.BeautyProfileRepository;
import com.hyperlocalmart.vendor.repository.BeautyRateRepository;
import com.hyperlocalmart.vendor.repository.BeautyVendorTreatmentRepository;
import com.hyperlocalmart.vendor.repository.ServiceOfferingRepository;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BeautyVendorService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");

    private final VendorRepository vendorRepository;
    private final BeautyProfileRepository profileRepository;
    private final BeautyRateRepository rateRepository;
    private final BeautyVendorTreatmentRepository treatmentRepository;
    private final ServiceOfferingRepository offeringRepository;

    @Transactional(readOnly = true)
    public List<BeautyArtistResponse> listForTown(UUID townId, boolean bookableOnly) {
        List<Vendor> vendors = vendorRepository.findByTownIdOrderByCreatedAtDesc(townId);
        if (vendors.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = vendors.stream().map(Vendor::getId).toList();
        Map<UUID, BeautyProfile> profiles = profileRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.toMap(BeautyProfile::getVendorId, Function.identity()));
        Map<UUID, List<BeautyRate>> rates = rateRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.groupingBy(BeautyRate::getVendorId));
        Map<UUID, Map<String, BeautyVendorTreatment>> treatments = treatmentRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.groupingBy(
                        BeautyVendorTreatment::getVendorId,
                        Collectors.toMap(BeautyVendorTreatment::getServiceCode, Function.identity(), (a, b) -> a, LinkedHashMap::new)));
        Map<UUID, ServiceOffering> offerings = offeringRepository.findAll().stream()
                .collect(Collectors.toMap(ServiceOffering::getId, Function.identity()));
        List<BeautyArtistResponse> out = new ArrayList<>();
        for (Vendor vendor : vendors) {
            if (!isBeautyVendor(vendor, offerings)) {
                continue;
            }
            BeautyProfile profile = profiles.get(vendor.getId());
            if (bookableOnly) {
                if (profile == null || !profile.isEnabled() || vendor.getStatus() != VendorStatus.ACTIVE) {
                    continue;
                }
            }
            BeautyArtistResponse row = toResponse(
                    vendor,
                    profile,
                    rates.getOrDefault(vendor.getId(), List.of()),
                    treatments.getOrDefault(vendor.getId(), Map.of()),
                    offerings);
            out.add(bookableOnly ? toBookable(row) : row);
        }
        out.sort(Comparator.comparing(
                        (BeautyArtistResponse row) -> row.getBusinessName() == null ? "" : row.getBusinessName(),
                        String.CASE_INSENSITIVE_ORDER)
                .thenComparing(BeautyArtistResponse::getVendorId));
        return out;
    }

    @Transactional(readOnly = true)
    public BeautyArtistResponse get(UUID vendorId) {
        Vendor vendor = requireVendor(vendorId);
        BeautyProfile profile = profileRepository.findById(vendorId).orElse(null);
        List<BeautyRate> rates = rateRepository.findByVendorIdOrderByServiceTypeAsc(vendorId);
        Map<String, BeautyVendorTreatment> treatments = treatmentRepository.findByVendorIdOrderByServiceCodeAsc(vendorId).stream()
                .collect(Collectors.toMap(BeautyVendorTreatment::getServiceCode, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        return toResponse(vendor, profile, rates, treatments, offeringsById());
    }

    @Transactional(readOnly = true)
    public BeautyArtistResponse getBookable(UUID vendorId) {
        return toBookable(get(vendorId));
    }

    @Transactional(readOnly = true)
    public UUID vendorIdForUser(UUID userId) {
        return vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"))
                .getId();
    }

    @Transactional(readOnly = true)
    public BeautyArtistResponse getForUser(UUID userId) {
        Vendor vendor = vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        return get(vendor.getId());
    }

    @Transactional
    public BeautyArtistResponse upsertByAdmin(UUID vendorId, UUID actorId, UpsertBeautyProfileRequest request) {
        Vendor vendor = requireVendor(vendorId);
        BeautyProfile profile = profileRepository.findById(vendorId).orElseGet(() -> BeautyProfile.builder()
                .vendorId(vendorId)
                .build());
        profile.setEnabled(Boolean.TRUE.equals(request.getEnabled()));
        profile.setTagline(trim(request.getTagline()));
        profile.setYearsExperience(request.getYearsExperience());
        if (request.getRatingScore() != null) {
            profile.setRatingScore(request.getRatingScore().setScale(2, RoundingMode.HALF_UP));
        }
        if (request.getRatingCount() != null) {
            profile.setRatingCount(Math.max(0, request.getRatingCount()));
        }
        if (request.getHomeVisitCharge() != null) {
            profile.setHomeVisitCharge(request.getHomeVisitCharge().setScale(2, RoundingMode.HALF_UP));
        }
        profile.setStudioAddress(trim(request.getStudioAddress()));
        profile.setClosedWeekdays(normalizeClosedDays(request.getClosedWeekdays()));
        applyBlockedSlots(profile, request.getBlockedSlotDate(), request.getBlockedSlotIds());
        if (request.getStaffCount() != null) {
            profile.setStaffCount(clampStaff(request.getStaffCount()));
        }
        applySlotSchedule(profile, request.getSlotDayOpen(), request.getSlotDayClose(), request.getSlotIntervalMinutes());
        if (request.getBookingMinPrepayAmount() != null) {
            profile.setBookingMinPrepayAmount(
                    request.getBookingMinPrepayAmount().max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        }
        profile.setUpdatedBy(actorId);
        if (profile.getCreatedBy() == null) {
            profile.setCreatedBy(actorId);
        }
        profileRepository.save(profile);

        syncCustomTreatments(vendorId, request.getCustomTreatments());
        if (request.getRates() != null) {
            applyRates(vendorId, actorId, request.getRates());
        }
        return get(vendorId);
    }

    @Transactional
    public BeautyArtistResponse upsertRatesByVendor(UUID userId, UpsertBeautyRatesRequest request) {
        Vendor vendor = vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        profileRepository.findById(vendor.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Glam is not turned on for this shop"));
        List<UpsertBeautyProfileRequest.CustomTreatmentInput> customs = request.getCustomTreatments() == null
                ? List.of()
                : request.getCustomTreatments().stream().map(row -> {
                    UpsertBeautyProfileRequest.CustomTreatmentInput input = new UpsertBeautyProfileRequest.CustomTreatmentInput();
                    input.setServiceCode(row.getServiceCode());
                    input.setLabel(row.getLabel());
                    input.setHint(row.getHint());
                    input.setEmoji(row.getEmoji());
                    return input;
                }).toList();
        syncCustomTreatments(vendor.getId(), customs);
        List<UpsertBeautyProfileRequest.RateInput> rates = request.getRates().stream().map(row -> {
            UpsertBeautyProfileRequest.RateInput input = new UpsertBeautyProfileRequest.RateInput();
            input.setServiceType(row.getServiceType());
            input.setUnitPrice(row.getUnitPrice());
            input.setDurationMinutes(row.getDurationMinutes());
            input.setPaused(row.getPaused());
            return input;
        }).toList();
        applyRates(vendor.getId(), userId, rates);
        return get(vendor.getId());
    }

    @Transactional
    public BeautyArtistResponse upsertOpsByVendor(UUID userId, UpsertBeautyOpsRequest request) {
        Vendor vendor = vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        BeautyProfile profile = profileRepository.findById(vendor.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Glam is not turned on for this shop"));
        if (request.getBlockedSlotIds() != null) {
            applyBlockedSlots(profile, request.getBlockedSlotDate(), request.getBlockedSlotIds());
        } else if (request.getBlockedSlotDate() != null) {
            applyBlockedSlots(profile, request.getBlockedSlotDate(), null);
        }
        if (request.getStaffCount() != null) {
            profile.setStaffCount(clampStaff(request.getStaffCount()));
        }
        if (hasSlotSchedulePatch(request)) {
            applySlotSchedule(profile, request.getSlotDayOpen(), request.getSlotDayClose(), request.getSlotIntervalMinutes());
        }
        if (request.getHomeVisitCharge() != null) {
            profile.setHomeVisitCharge(
                    request.getHomeVisitCharge().max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP));
        }
        applyStaffOverride(profile, request.getStaffOverrideDate(), request.getStaffCountForDate());
        profile.setUpdatedBy(userId);
        profileRepository.saveAndFlush(profile);
        return get(vendor.getId());
    }

    private static int clampStaff(int value) {
        return BeautyStaffOverrides.clampStaff(value);
    }

    private void applyStaffOverride(BeautyProfile profile, String staffOverrideDate, Integer staffCountForDate) {
        if (staffOverrideDate == null || staffOverrideDate.isBlank()) {
            return;
        }
        if (staffCountForDate == null) {
            return;
        }
        LocalDate day = parseBlockedDate(staffOverrideDate);
        if (day == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Staff override date must be YYYY-MM-DD");
        }
        profile.setStaffOverrides(BeautyStaffOverrides.putOverride(
                profile.getStaffOverrides(),
                day,
                staffCountForDate,
                profile.getStaffCount()));
    }

    private void applyBlockedSlots(BeautyProfile profile, String blockedSlotDate, String blockedSlotIds) {
        if (blockedSlotIds == null && blockedSlotDate == null) {
            return;
        }
        if (blockedSlotIds != null) {
            String slots = normalizeBlockedSlots(profile, blockedSlotIds);
            LocalDate date = parseBlockedDate(blockedSlotDate);
            if (date == null) {
                date = profile.getBlockedSlotDate() != null ? profile.getBlockedSlotDate() : LocalDate.now(IST);
            }
            BeautySlotSchedule schedule = scheduleOf(profile);
            profile.setBlockedSlotsByDate(BeautySlotBlocks.putForDate(profile.getBlockedSlotsByDate(), date, slots, schedule));
            profile.setBlockedSlotIds(slots);
            if (slots.isEmpty()) {
                profile.setBlockedSlotDate(null);
            } else {
                profile.setBlockedSlotDate(date);
            }
        } else if (blockedSlotDate != null) {
            profile.setBlockedSlotDate(parseBlockedDate(blockedSlotDate));
        }
    }

    private static BeautyArtistResponse toBookable(BeautyArtistResponse artist) {
        if (artist.getRates() == null || artist.getRates().isEmpty()) {
            return artist;
        }
        artist.setRates(artist.getRates().stream().filter(rate -> !rate.isPaused()).toList());
        return artist;
    }

    private Map<UUID, ServiceOffering> offeringsById() {
        return offeringRepository.findAll().stream()
                .collect(Collectors.toMap(ServiceOffering::getId, Function.identity()));
    }

    private static boolean isBeautyVendor(Vendor vendor, Map<UUID, ServiceOffering> offerings) {
        if (vendor.getServiceId() == null) {
            return false;
        }
        ServiceOffering offering = offerings.get(vendor.getServiceId());
        return CatalogListingPolicy.isBeautyService(offering == null ? null : offering.getName());
    }

    private void applyRates(UUID vendorId, UUID actorId, List<UpsertBeautyProfileRequest.RateInput> inputs) {
        Map<String, BeautyRate> existing = rateRepository.findByVendorIdOrderByServiceTypeAsc(vendorId).stream()
                .collect(Collectors.toMap(BeautyRate::getServiceType, Function.identity(), (a, b) -> a, LinkedHashMap::new));
        Set<String> keepCodes = new HashSet<>();
        for (UpsertBeautyProfileRequest.RateInput input : inputs) {
            if (input.getUnitPrice() == null || input.getUnitPrice().signum() <= 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Each listed treatment needs a price above zero");
            }
            String service = BeautyServiceCatalog.normalizeCode(input.getServiceType());
            keepCodes.add(service);
            BigDecimal price = input.getUnitPrice().setScale(2, RoundingMode.HALF_UP);
            int minutes = input.getDurationMinutes() == null ? 60 : Math.max(15, input.getDurationMinutes());
            BeautyRate rate = existing.get(service);
            if (rate == null) {
                rate = BeautyRate.builder().vendorId(vendorId).serviceType(service).build();
                rate.setCreatedBy(actorId);
            }
            rate.setUnitPrice(price);
            rate.setDurationMinutes(minutes);
            rate.setPaused(Boolean.TRUE.equals(input.getPaused()));
            rate.setUpdatedBy(actorId);
            rateRepository.save(rate);
        }
        for (BeautyRate rate : rateRepository.findByVendorIdOrderByServiceTypeAsc(vendorId)) {
            if (!keepCodes.contains(rate.getServiceType())) {
                rateRepository.delete(rate);
                if (BeautyServiceCatalog.isCustom(rate.getServiceType())) {
                    treatmentRepository.deleteByVendorIdAndServiceCode(vendorId, rate.getServiceType());
                }
            }
        }
    }

    private void syncCustomTreatments(UUID vendorId, List<UpsertBeautyProfileRequest.CustomTreatmentInput> rows) {
        if (rows == null) {
            return;
        }
        for (UpsertBeautyProfileRequest.CustomTreatmentInput row : rows) {
            if (row.getServiceCode() == null || row.getLabel() == null || row.getLabel().isBlank()) {
                continue;
            }
            String code = BeautyServiceCatalog.normalizeCode(row.getServiceCode());
            if (!BeautyServiceCatalog.isCustom(code)) {
                continue;
            }
            String emoji = row.getEmoji() == null || row.getEmoji().isBlank() ? "✨" : row.getEmoji().trim();
            BeautyVendorTreatment treatment = treatmentRepository
                    .findById(new BeautyVendorTreatment.Key(vendorId, code))
                    .orElseGet(() -> BeautyVendorTreatment.builder().vendorId(vendorId).serviceCode(code).build());
            treatment.setLabel(row.getLabel().trim());
            treatment.setHint(trim(row.getHint()));
            treatment.setEmoji(emoji.length() > 8 ? emoji.substring(0, 8) : emoji);
            treatmentRepository.save(treatment);
        }
    }

    private BeautyArtistResponse toResponse(
            Vendor vendor,
            BeautyProfile profile,
            List<BeautyRate> rates,
            Map<String, BeautyVendorTreatment> treatments,
            Map<UUID, ServiceOffering> offerings) {
        ServiceOffering offering = vendor.getServiceId() == null ? null : offerings.get(vendor.getServiceId());
        return BeautyArtistResponse.builder()
                .vendorId(vendor.getId())
                .townId(vendor.getTownId())
                .businessName(vendor.getBusinessName())
                .phone(vendor.getPhone())
                .vendorStatus(vendor.getStatus().name())
                .serviceName(offering == null ? null : offering.getName())
                .enabled(profile != null && profile.isEnabled())
                .tagline(profile == null ? null : profile.getTagline())
                .yearsExperience(profile == null ? null : profile.getYearsExperience())
                .ratingScore(profile == null ? new BigDecimal("4.80") : profile.getRatingScore())
                .ratingCount(profile == null ? 0 : profile.getRatingCount())
                .homeVisitCharge(profile == null ? BigDecimal.ZERO : profile.getHomeVisitCharge())
                .studioAddress(profile == null ? null : profile.getStudioAddress())
                .closedWeekdays(profile == null ? "" : profile.getClosedWeekdays())
                .blockedSlotDate(liveBlockedDate(profile))
                .blockedSlotIds(liveBlockedSlots(profile))
                .blockedSlotsByDate(profile == null || profile.getBlockedSlotsByDate() == null
                        ? "{}"
                        : profile.getBlockedSlotsByDate())
                .staffCount(profile == null ? 1 : clampStaff(profile.getStaffCount()))
                .slotDayOpen(formatSlotTime(profile == null ? null : profile.getSlotDayOpen()))
                .slotDayClose(formatSlotTime(profile == null ? null : profile.getSlotDayClose()))
                .slotIntervalMinutes(profile == null ? 45 : BeautySlotSchedule.clampInterval(profile.getSlotIntervalMinutes()))
                .staffOverrides(profile == null || profile.getStaffOverrides() == null ? "{}" : profile.getStaffOverrides())
                .bookingMinPrepayAmount(profile == null
                        ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP)
                        : moneyOrZero(profile.getBookingMinPrepayAmount()))
                .rates(rates.stream()
                        .sorted(Comparator.comparing(BeautyRate::getServiceType))
                        .map(rate -> toRateRow(rate, treatments.get(rate.getServiceType())))
                        .toList())
                .build();
    }

    private static BeautyArtistResponse.RateRow toRateRow(BeautyRate rate, BeautyVendorTreatment custom) {
        BeautyServiceCatalog.Meta meta = BeautyServiceCatalog.standardMeta(rate.getServiceType())
                .orElse(null);
        String label = custom != null ? custom.getLabel() : meta != null ? meta.label() : rate.getServiceType();
        String hint = custom != null && custom.getHint() != null ? custom.getHint() : meta != null ? meta.hint() : "";
        String emoji = custom != null ? custom.getEmoji() : meta != null ? meta.emoji() : "✨";
        return BeautyArtistResponse.RateRow.builder()
                .serviceType(rate.getServiceType())
                .label(label)
                .hint(hint)
                .emoji(emoji)
                .unitPrice(rate.getUnitPrice())
                .durationMinutes(rate.getDurationMinutes())
                .paused(rate.isPaused())
                .build();
    }

    private Vendor requireVendor(UUID vendorId) {
        return vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
    }

    private static String trim(String raw) {
        if (raw == null) {
            return null;
        }
        String value = raw.trim();
        return value.isEmpty() ? null : value;
    }

    static String normalizeClosedDays(String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        EnumSet<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        for (String part : raw.split(",")) {
            String token = part.trim().toUpperCase();
            if (token.isEmpty()) {
                continue;
            }
            try {
                days.add(DayOfWeek.valueOf(token));
            } catch (IllegalArgumentException ex) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Closed day must be a weekday name like SUNDAY");
            }
        }
        return days.stream().sorted(Comparator.comparingInt(DayOfWeek::getValue)).map(DayOfWeek::name)
                .collect(Collectors.joining(","));
    }

    /** Drops blocked ids that no longer exist after a schedule change (does not throw). */
    private static String pruneBlockedSlots(BeautyProfile profile, String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        BeautySlotSchedule schedule = scheduleOf(profile);
        LinkedHashSet<String> slots = new LinkedHashSet<>();
        for (String part : raw.split(",")) {
            String id = part.trim();
            if (id.isEmpty()) {
                continue;
            }
            if (schedule.isValidId(id)) {
                slots.add(id);
            }
        }
        return String.join(",", slots);
    }

    static String normalizeBlockedSlots(BeautyProfile profile, String raw) {
        if (raw == null || raw.isBlank()) {
            return "";
        }
        BeautySlotSchedule schedule = scheduleOf(profile);
        LinkedHashSet<String> slots = new LinkedHashSet<>();
        for (String part : raw.split(",")) {
            String id = part.trim();
            if (id.isEmpty()) {
                continue;
            }
            if (!schedule.isValidId(id)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown appointment slot");
            }
            slots.add(id);
        }
        return String.join(",", slots);
    }

    private static BeautySlotSchedule scheduleOf(BeautyProfile profile) {
        if (profile == null) {
            return BeautySlotSchedule.defaults();
        }
        return BeautySlotSchedule.parse(
                formatSlotTime(profile.getSlotDayOpen()),
                formatSlotTime(profile.getSlotDayClose()),
                profile.getSlotIntervalMinutes());
    }

    private static boolean hasSlotSchedulePatch(UpsertBeautyOpsRequest request) {
        if (request == null) {
            return false;
        }
        return hasText(request.getSlotDayOpen())
                || hasText(request.getSlotDayClose())
                || request.getSlotIntervalMinutes() != null;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private void applySlotSchedule(
            BeautyProfile profile,
            String slotDayOpen,
            String slotDayClose,
            Integer slotIntervalMinutes) {
        if (!hasText(slotDayOpen) && !hasText(slotDayClose) && slotIntervalMinutes == null) {
            return;
        }
        try {
            LocalTime open = hasText(slotDayOpen)
                    ? BeautySlotSchedule.parseLocalTime(slotDayOpen, profile.getSlotDayOpen())
                    : profile.getSlotDayOpen();
            LocalTime close = hasText(slotDayClose)
                    ? BeautySlotSchedule.parseLocalTime(slotDayClose, profile.getSlotDayClose())
                    : profile.getSlotDayClose();
            int interval = slotIntervalMinutes != null ? slotIntervalMinutes : profile.getSlotIntervalMinutes();
            BeautySlotSchedule next = BeautySlotSchedule.normalize(open, close, interval);
            profile.setSlotDayOpen(next.dayOpen());
            profile.setSlotDayClose(next.dayClose());
            profile.setSlotIntervalMinutes(next.intervalMinutes());
            profile.setBlockedSlotIds(pruneBlockedSlots(profile, profile.getBlockedSlotIds()));
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, ex.getMessage());
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Use times like 09:00 and 18:00");
        }
    }

    private static String formatSlotTime(LocalTime time) {
        return (time == null ? BeautySlotSchedule.defaults().dayOpen() : time).format(HM);
    }

    private static LocalDate parseBlockedDate(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return LocalDate.parse(raw.trim());
    }

    private static String liveBlockedDate(BeautyProfile profile) {
        if (profile == null || profile.getBlockedSlotDate() == null) {
            return null;
        }
        if (profile.getBlockedSlotDate().isBefore(LocalDate.now(IST))) {
            return null;
        }
        String slots = liveBlockedSlots(profile);
        return slots.isEmpty() ? null : profile.getBlockedSlotDate().toString();
    }

    private static String liveBlockedSlots(BeautyProfile profile) {
        if (profile == null || profile.getBlockedSlotDate() == null) {
            return "";
        }
        if (profile.getBlockedSlotDate().isBefore(LocalDate.now(IST))) {
            return "";
        }
        return profile.getBlockedSlotIds() == null ? "" : profile.getBlockedSlotIds();
    }

    private static BigDecimal moneyOrZero(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
