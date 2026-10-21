package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpsertLaundryOpsRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertLaundryProfileRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertLaundryRatesRequest;
import com.hyperlocalmart.vendor.dto.response.LaundryShopResponse;
import com.hyperlocalmart.vendor.entity.LaundryProfile;
import com.hyperlocalmart.vendor.entity.LaundryRate;
import com.hyperlocalmart.vendor.entity.LaundryRateHistory;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.entity.VendorCommercialTerms;
import com.hyperlocalmart.vendor.entity.VendorStatus;
import com.hyperlocalmart.vendor.laundry.LaundryItemType;
import com.hyperlocalmart.vendor.laundry.LaundryServiceType;
import com.hyperlocalmart.vendor.repository.LaundryProfileRepository;
import com.hyperlocalmart.vendor.repository.LaundryRateHistoryRepository;
import com.hyperlocalmart.vendor.repository.LaundryRateRepository;
import com.hyperlocalmart.vendor.repository.VendorCommercialTermsRepository;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LaundryVendorService {

    private static final DateTimeFormatter CHANGED_AT = DateTimeFormatter.ISO_INSTANT;

    private final VendorRepository vendorRepository;
    private final LaundryProfileRepository profileRepository;
    private final LaundryRateRepository rateRepository;
    private final LaundryRateHistoryRepository historyRepository;
    private final VendorCommercialTermsRepository termsRepository;

    @Transactional(readOnly = true)
    public List<LaundryShopResponse> listForTown(UUID townId, boolean bookableOnly) {
        List<Vendor> vendors = vendorRepository.findByTownIdOrderByCreatedAtDesc(townId);
        if (vendors.isEmpty()) {
            return List.of();
        }
        List<UUID> ids = vendors.stream().map(Vendor::getId).toList();
        Map<UUID, LaundryProfile> profiles = profileRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.toMap(LaundryProfile::getVendorId, Function.identity()));
        Map<UUID, List<LaundryRate>> rates = rateRepository.findByVendorIdIn(ids).stream()
                .collect(Collectors.groupingBy(LaundryRate::getVendorId));
        List<LaundryShopResponse> out = new ArrayList<>();
        for (Vendor vendor : vendors) {
            LaundryProfile profile = profiles.get(vendor.getId());
            if (bookableOnly) {
                if (profile == null || !profile.isEnabled() || vendor.getStatus() != VendorStatus.ACTIVE) {
                    continue;
                }
            }
            LaundryShopResponse row = toResponse(vendor, profile, rates.getOrDefault(vendor.getId(), List.of()), false, true);
            out.add(bookableOnly ? toBookable(row) : row);
        }
        return out;
    }

    @Transactional(readOnly = true)
    public LaundryShopResponse get(UUID vendorId, boolean includeHistory, boolean includeFees) {
        Vendor vendor = requireVendor(vendorId);
        LaundryProfile profile = profileRepository.findById(vendorId).orElse(null);
        List<LaundryRate> rates = rateRepository.findByVendorIdOrderByServiceTypeAscItemTypeAsc(vendorId);
        return toResponse(vendor, profile, rates, includeHistory, includeFees);
    }

    @Transactional(readOnly = true)
    public LaundryShopResponse getBookable(UUID vendorId) {
        return toBookable(get(vendorId, false, true));
    }

    private static LaundryShopResponse toBookable(LaundryShopResponse shop) {
        if (shop.getRates() == null || shop.getRates().isEmpty()) {
            return shop;
        }
        shop.setRates(shop.getRates().stream().filter(rate -> !rate.isPaused()).toList());
        return shop;
    }

    @Transactional(readOnly = true)
    public LaundryShopResponse getForUser(UUID userId, boolean includeHistory) {
        Vendor vendor = vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        return get(vendor.getId(), includeHistory, true);
    }

    @Transactional(readOnly = true)
    public UUID vendorIdForUser(UUID userId) {
        return vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"))
                .getId();
    }

    @Transactional
    public LaundryShopResponse upsertByAdmin(UUID vendorId, UUID actorId, UpsertLaundryProfileRequest request) {
        Vendor vendor = requireVendor(vendorId);
        LaundryProfile profile = profileRepository.findById(vendorId).orElseGet(() -> LaundryProfile.builder()
                .vendorId(vendorId)
                .enabled(false)
                .priceEditAllowed(false)
                .closedWeekdays("")
                .build());
        if (profile.getCreatedBy() == null) {
            profile.setCreatedBy(actorId);
        }
        if (request.getEnabled() != null) {
            profile.setEnabled(request.getEnabled());
        }
        if (request.getPriceEditAllowed() != null) {
            profile.setPriceEditAllowed(request.getPriceEditAllowed());
        }
        applyOps(profile, request.getDailyPieceCapacity(), request.getClearDailyPieceCapacity(), request.getClosedWeekdays());
        applyTripCharges(profile, request.getPickupCharge(), request.getDropCharge(), request.getPickupAndDropCharge());
        profile.setUpdatedBy(actorId);
        profileRepository.save(profile);
        if (request.getRates() != null && !request.getRates().isEmpty()) {
            saveRates(vendorId, actorId, request.getRates(), true);
        }
        return get(vendor.getId(), true, true);
    }

    @Transactional
    public LaundryShopResponse upsertRatesByVendor(UUID userId, UpsertLaundryRatesRequest request) {
        Vendor vendor = vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        LaundryProfile profile = profileRepository.findById(vendor.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Laundry is not turned on for this shop"));
        boolean canEditPrice = profile.isPriceEditAllowed();
        if (canEditPrice) {
            applyTripCharges(profile, request.getPickupCharge(), request.getDropCharge(), request.getPickupAndDropCharge());
            profile.setUpdatedBy(userId);
            profileRepository.save(profile);
        }
        saveRates(vendor.getId(), userId, request.getRates(), canEditPrice);
        return get(vendor.getId(), true, true);
    }

    @Transactional
    public LaundryShopResponse upsertOpsByVendor(UUID userId, UpsertLaundryOpsRequest request) {
        Vendor vendor = vendorRepository.findByUserId(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        LaundryProfile profile = profileRepository.findById(vendor.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.VALIDATION_ERROR, "Laundry is not turned on for this shop"));
        applyOps(profile, request.getDailyPieceCapacity(), request.getClearDailyPieceCapacity(), request.getClosedWeekdays());
        profile.setUpdatedBy(userId);
        profileRepository.save(profile);
        return get(vendor.getId(), false, true);
    }

    private void applyOps(LaundryProfile profile, Integer capacity, Boolean clear, String closedWeekdays) {
        if (Boolean.TRUE.equals(clear)) {
            profile.setDailyPieceCapacity(null);
        } else if (capacity != null) {
            if (capacity < 1) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Daily piece capacity must be at least 1");
            }
            profile.setDailyPieceCapacity(capacity);
        }
        if (closedWeekdays != null) {
            profile.setClosedWeekdays(normalizeClosedDays(closedWeekdays));
        }
    }

    private void saveRates(
            UUID vendorId,
            UUID actorId,
            List<UpsertLaundryProfileRequest.RateInput> inputs,
            boolean canEditPrice) {
        if (inputs == null || inputs.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Add at least one rate");
        }
        Map<String, LaundryRate> existing = rateRepository.findByVendorIdOrderByServiceTypeAscItemTypeAsc(vendorId)
                .stream()
                .collect(Collectors.toMap(rate -> key(rate.getServiceType(), rate.getItemType()), Function.identity()));
        for (UpsertLaundryProfileRequest.RateInput input : inputs) {
            LaundryServiceType service = parseService(input.getServiceType());
            LaundryItemType item = parseItem(input.getItemType());
            BigDecimal price = money(input.getUnitPrice());
            LaundryRate rate = existing.get(key(service, item));
            boolean paused = input.getPaused() == null
                    ? rate != null && rate.isPaused()
                    : Boolean.TRUE.equals(input.getPaused());
            if (rate == null) {
                if (!canEditPrice) {
                    continue;
                }
                rate = LaundryRate.builder()
                        .vendorId(vendorId)
                        .serviceType(service)
                        .itemType(item)
                        .unitPrice(price)
                        .paused(paused)
                        .build();
                rate.setCreatedBy(actorId);
                rate.setUpdatedBy(actorId);
                rateRepository.save(rate);
                writeHistory(vendorId, actorId, service, item, price);
                continue;
            }
            boolean priceChanged = canEditPrice && rate.getUnitPrice().compareTo(price) != 0;
            boolean pauseChanged = rate.isPaused() != paused;
            if (!priceChanged && !pauseChanged) {
                continue;
            }
            if (priceChanged) {
                rate.setUnitPrice(price);
            }
            if (pauseChanged) {
                rate.setPaused(paused);
            }
            rate.setUpdatedBy(actorId);
            rateRepository.save(rate);
            if (priceChanged) {
                writeHistory(vendorId, actorId, service, item, price);
            }
        }
    }

    private void writeHistory(UUID vendorId, UUID actorId, LaundryServiceType service, LaundryItemType item, BigDecimal price) {
        LaundryRateHistory row = LaundryRateHistory.builder()
                .vendorId(vendorId)
                .serviceType(service.name())
                .itemType(item.name())
                .unitPrice(price)
                .build();
        row.setCreatedBy(actorId);
        row.setUpdatedBy(actorId);
        historyRepository.save(row);
    }

    private LaundryShopResponse toResponse(
            Vendor vendor,
            LaundryProfile profile,
            List<LaundryRate> rates,
            boolean includeHistory,
            boolean includeFees) {
        LaundryShopResponse.LaundryShopResponseBuilder builder = LaundryShopResponse.builder()
                .vendorId(vendor.getId())
                .townId(vendor.getTownId())
                .businessName(vendor.getBusinessName())
                .phone(vendor.getPhone())
                .vendorStatus(vendor.getStatus().name())
                .enabled(profile != null && profile.isEnabled())
                .priceEditAllowed(profile != null && profile.isPriceEditAllowed())
                .dailyPieceCapacity(profile == null ? null : profile.getDailyPieceCapacity())
                .closedWeekdays(profile == null ? "" : profile.getClosedWeekdays())
                .pickupCharge(profile == null || profile.getPickupCharge() == null ? BigDecimal.ZERO : profile.getPickupCharge())
                .dropCharge(profile == null || profile.getDropCharge() == null ? BigDecimal.ZERO : profile.getDropCharge())
                .pickupAndDropCharge(profile == null || profile.getPickupAndDropCharge() == null ? BigDecimal.ZERO : profile.getPickupAndDropCharge())
                .rates(rates.stream()
                        .sorted(Comparator.comparing(LaundryRate::getServiceType).thenComparing(LaundryRate::getItemType))
                        .map(rate -> LaundryShopResponse.RateRow.builder()
                                .serviceType(rate.getServiceType().name())
                                .itemType(rate.getItemType().name())
                                .unitPrice(rate.getUnitPrice())
                                .paused(rate.isPaused())
                                .build())
                        .toList());
        if (includeHistory) {
            builder.rateHistory(historyRepository.findTop30ByVendorIdOrderByCreatedAtDesc(vendor.getId()).stream()
                    .map(row -> LaundryShopResponse.RateChange.builder()
                            .serviceType(row.getServiceType())
                            .itemType(row.getItemType())
                            .unitPrice(row.getUnitPrice())
                            .changedAt(row.getCreatedAt() == null ? null : CHANGED_AT.format(row.getCreatedAt()))
                            .build())
                    .toList());
        }
        if (includeFees) {
            termsRepository.findByVendorIdAndEffectiveToIsNull(vendor.getId()).ifPresent(terms -> applyFees(builder, terms));
        }
        return builder.build();
    }

    private static void applyFees(LaundryShopResponse.LaundryShopResponseBuilder builder, VendorCommercialTerms terms) {
        builder.feeModel(terms.getFeeModel().name())
                .perPieceAmount(terms.getPerPieceAmount())
                .perOrderFlatAmount(terms.getPerOrderFlatAmount())
                .monthlySubscriptionAmount(terms.getMonthlySubscriptionAmount());
    }

    private Vendor requireVendor(UUID vendorId) {
        return vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
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

    private static LaundryServiceType parseService(String raw) {
        try {
            return LaundryServiceType.valueOf(raw.trim().toUpperCase());
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown laundry service");
        }
    }

    private static LaundryItemType parseItem(String raw) {
        try {
            return LaundryItemType.valueOf(raw.trim().toUpperCase());
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown laundry item");
        }
    }

    private static String key(LaundryServiceType service, LaundryItemType item) {
        return service.name() + "|" + item.name();
    }

    private static void applyTripCharges(LaundryProfile profile, BigDecimal pickup, BigDecimal drop, BigDecimal both) {
        if (pickup != null) {
            profile.setPickupCharge(money(pickup));
        }
        if (drop != null) {
            profile.setDropCharge(money(drop));
        }
        if (both != null) {
            profile.setPickupAndDropCharge(money(both));
        }
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null || value.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Rate must be ₹0 or more");
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
