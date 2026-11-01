package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.request.PatchTownFeatureFlagsRequest;
import com.hyperlocalmart.town.dto.request.UpdateTownConfigRequest;
import com.hyperlocalmart.town.dto.response.TownOperationalConfigResponse;
import com.hyperlocalmart.town.dto.response.TownShopSettingsResponse;
import com.hyperlocalmart.town.entity.TownConfig;
import com.hyperlocalmart.town.repository.TownConfigRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import com.hyperlocalmart.town.scratch.ScratchPrepayModeFilter;
import com.hyperlocalmart.town.scratch.ScratchServiceKind;
import com.hyperlocalmart.town.scratch.ScratchServiceRules;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class TownConfigService {

    private static final String OPERATIONAL_KEY = "operational";
    private static final BigDecimal DEFAULT_MIN_ORDER = new BigDecimal("199");
    private static final String DEFAULT_THEME_COLOR = "#009111";
    private static final String MODE_DEFAULT = "DEFAULT";
    private static final String MODE_SLAB = "SLAB";
    private static final String DEFAULT_WINDOW_START = "17:00";
    private static final String DEFAULT_WINDOW_END = "19:00";
    private static final Pattern WINDOW_HHMM = Pattern.compile("^([01]\\d|2[0-3]):[0-5]\\d$");
    private static final BigDecimal DEFAULT_SCRATCH_MIN = new BigDecimal("10.00");
    private static final BigDecimal DEFAULT_SCRATCH_MAX = new BigDecimal("50.00");
    private static final BigDecimal DEFAULT_SCRATCH_Z = new BigDecimal("499.00");

    private final TownConfigRepository townConfigRepository;
    private final TownRepository townRepository;
    private final PlatformSettingsService platformSettingsService;
    private final AdminAuditor adminAuditService;

    @Transactional(readOnly = true)
    public TownOperationalConfigResponse getOperationalConfig(UUID townId) {
        return townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, OPERATIONAL_KEY)
                .map(this::toOperational)
                .orElseGet(this::defaultOperational);
    }

    /**
     * Ensures every new town has an operational config row (min order, etc.)
     * so N-town launches do not rely on seed data for one pilot town.
     */
    @Transactional
    public void ensureDefaultOperationalConfig(UUID townId) {
        boolean exists = townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, OPERATIONAL_KEY)
                .isPresent();
        if (exists) {
            return;
        }
        Map<String, Object> value = defaultConfigValue();
        Instant now = Instant.now();
        TownConfig config = TownConfig.builder()
                .townId(townId)
                .configKey(OPERATIONAL_KEY)
                .configValue(value)
                .effectiveFrom(now)
                .createdAt(now)
                .updatedAt(now)
                .build();
        townConfigRepository.save(config);
    }

    @Transactional
    public TownOperationalConfigResponse updateOperationalConfig(UUID townId, UpdateTownConfigRequest request) {
        return updateOperationalConfig(townId, request, null);
    }

    @Transactional
    public TownOperationalConfigResponse updateOperationalConfig(
            UUID townId, UpdateTownConfigRequest request, UUID actorId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        ensureDefaultOperationalConfig(townId);

        TownConfig config = townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, OPERATIONAL_KEY)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Town config not found"));

        Map<String, Object> before = config.getConfigValue() != null
                ? new LinkedHashMap<>(config.getConfigValue()) : defaultConfigValue();
        Map<String, Object> value = new LinkedHashMap<>(before);

        if (request.getMinOrderValue() != null) {
            if (request.getMinOrderValue().compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "minOrderValue must be >= 0");
            }
            value.put("minOrderValue", request.getMinOrderValue().setScale(2, RoundingMode.HALF_UP));
        }

        String mode = request.getDeliveryMode() != null
                ? request.getDeliveryMode().trim().toUpperCase()
                : String.valueOf(value.getOrDefault("deliveryMode", MODE_DEFAULT));
        if (!MODE_DEFAULT.equals(mode) && !MODE_SLAB.equals(mode)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "deliveryMode must be DEFAULT or SLAB");
        }
        value.put("deliveryMode", mode);

        List<Map<String, Object>> slabs = normalizeSlabs(request.getDeliverySlabs(), mode);
        value.put("deliverySlabs", slabs);

        if (request.getThemeColor() != null) {
            value.put("themeColor", normalizeThemeColor(request.getThemeColor()));
        }
        if (request.getBestDealsEnabled() != null) {
            value.put("bestDealsEnabled", request.getBestDealsEnabled());
        }
        if (request.getDealPrices() != null) {
            value.put("dealPrices", normalizeDealPrices(request.getDealPrices()));
        }
        if (request.getPlatformFee() != null) {
            value.put("platformFee", normalizePlatformFee(request.getPlatformFee()));
        }
        applyScratchCard(value, request);
        if (request.getBuyerMembershipEnabled() != null) {
            value.put("buyerMembershipEnabled", request.getBuyerMembershipEnabled());
        }
        applyPaymentSettings(value, request);
        applyDeliveryWindow(value, request);
        if (request.getLaundryEnabled() != null) {
            value.put("laundryEnabled", request.getLaundryEnabled());
        }
        if (request.getBeautyEnabled() != null) {
            value.put("beautyEnabled", request.getBeautyEnabled());
        }
        applyBeautyPaymentSettings(value, request);
        if (request.getBuyerCancelOrderEnabled() != null) {
            value.put("buyerCancelOrderEnabled", request.getBuyerCancelOrderEnabled());
        }
        if (request.getBuyerCancelItemsEnabled() != null) {
            value.put("buyerCancelItemsEnabled", request.getBuyerCancelItemsEnabled());
        }

        config.setConfigValue(value);
        config.setUpdatedAt(Instant.now());
        townConfigRepository.save(config);
        String townName = townRepository.findById(townId)
                .map(town -> town.getDisplayName() != null ? town.getDisplayName() : town.getName())
                .orElse("Town");
        adminAuditService.record(
                "town-settings",
                "UPDATE_TOWN_SETTINGS",
                settingsChangeSummary(townName, before, value),
                actorId,
                "SUPER_ADMIN",
                townId,
                "TOWN_CONFIG",
                config.getId(),
                before,
                value);
        return toOperational(config);
    }

    @Transactional
    public TownOperationalConfigResponse patchFeatureFlags(
            UUID townId, PatchTownFeatureFlagsRequest request, UUID actorId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        if (request.getLaundryEnabled() == null && request.getBeautyEnabled() == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "No feature flags to update");
        }
        ensureDefaultOperationalConfig(townId);
        TownConfig config = townConfigRepository
                .findFirstByTownIdAndConfigKeyAndEffectiveToIsNullOrderByEffectiveFromDesc(townId, OPERATIONAL_KEY)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Town config not found"));
        Map<String, Object> before = config.getConfigValue() != null
                ? new LinkedHashMap<>(config.getConfigValue()) : defaultConfigValue();
        Map<String, Object> value = new LinkedHashMap<>(before);
        if (request.getLaundryEnabled() != null) {
            value.put("laundryEnabled", request.getLaundryEnabled());
        }
        if (request.getBeautyEnabled() != null) {
            value.put("beautyEnabled", request.getBeautyEnabled());
        }
        config.setConfigValue(value);
        config.setUpdatedAt(Instant.now());
        townConfigRepository.save(config);
        String townName = townRepository.findById(townId)
                .map(town -> town.getDisplayName() != null ? town.getDisplayName() : town.getName())
                .orElse("Town");
        adminAuditService.record(
                "town-settings",
                "PATCH_TOWN_FEATURES",
                settingsChangeSummary(townName, before, value),
                actorId,
                "SUPER_ADMIN",
                townId,
                "TOWN_CONFIG",
                config.getId(),
                before,
                value);
        return toOperational(config);
    }

    /**
     * Resolve delivery fee for a town + order value.
     * DEFAULT → platform flat fee; SLAB → matching slab (fallback platform).
     */
    @Transactional(readOnly = true)
    public Map<String, Object> resolveDeliveryFee(UUID townId, BigDecimal orderValue) {
        TownOperationalConfigResponse config = getOperationalConfig(townId);
        BigDecimal platformDeliveryFee = platformSettingsService.resolveDeliveryFee();
        BigDecimal buyerPlatformFee = config.getPlatformFee() == null ? BigDecimal.ZERO : config.getPlatformFee();
        BigDecimal value = orderValue == null ? BigDecimal.ZERO : orderValue.max(BigDecimal.ZERO);

        if (MODE_SLAB.equalsIgnoreCase(config.getDeliveryMode())
                && config.getDeliverySlabs() != null
                && !config.getDeliverySlabs().isEmpty()) {
            BigDecimal currentFee = platformDeliveryFee;
            boolean matched = false;
            for (TownOperationalConfigResponse.DeliverySlabResponse slab : config.getDeliverySlabs()) {
                BigDecimal min = slab.getMinOrderValue() == null ? BigDecimal.ZERO : slab.getMinOrderValue();
                BigDecimal max = slab.getMaxOrderValue();
                boolean geMin = value.compareTo(min) >= 0;
                boolean ltMax = max == null || value.compareTo(max) <= 0;
                if (geMin && ltMax) {
                    currentFee = slab.getDeliveryFee() == null ? platformDeliveryFee : slab.getDeliveryFee();
                    matched = true;
                    break;
                }
            }
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("deliveryFee", currentFee);
            result.put("platformFee", buyerPlatformFee);
            result.put("deliveryMode", MODE_SLAB);
            result.put("source", matched ? "TOWN_SLAB" : "PLATFORM_FALLBACK");
            putCheaperDeliveryHint(result, config.getDeliverySlabs(), value, currentFee, platformDeliveryFee);
            return result;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("deliveryFee", platformDeliveryFee);
        result.put("platformFee", buyerPlatformFee);
        result.put("deliveryMode", MODE_DEFAULT);
        result.put("source", "PLATFORM_DEFAULT");
        return result;
    }

    /**
     * Buyer nudge: nearest slab whose fee is strictly lower than the current fee.
     */
    private static void putCheaperDeliveryHint(
            Map<String, Object> result,
            List<TownOperationalConfigResponse.DeliverySlabResponse> slabs,
            BigDecimal cartValue,
            BigDecimal currentFee,
            BigDecimal platformDeliveryFee) {
        TownOperationalConfigResponse.DeliverySlabResponse target = null;
        for (TownOperationalConfigResponse.DeliverySlabResponse slab : slabs) {
            BigDecimal min = slab.getMinOrderValue() == null ? BigDecimal.ZERO : slab.getMinOrderValue();
            BigDecimal fee = slab.getDeliveryFee() == null ? platformDeliveryFee : slab.getDeliveryFee();
            if (fee.compareTo(currentFee) >= 0) {
                continue;
            }
            if (cartValue.compareTo(min) >= 0) {
                continue;
            }
            if (target == null) {
                target = slab;
                continue;
            }
            BigDecimal targetFee = target.getDeliveryFee() == null ? platformDeliveryFee : target.getDeliveryFee();
            BigDecimal targetMin = target.getMinOrderValue() == null ? BigDecimal.ZERO : target.getMinOrderValue();
            int closer = min.compareTo(targetMin);
            if (closer < 0 || (closer == 0 && fee.compareTo(targetFee) < 0)) {
                target = slab;
            }
        }
        if (target == null) {
            return;
        }
        BigDecimal min = target.getMinOrderValue() == null ? BigDecimal.ZERO : target.getMinOrderValue();
        BigDecimal fee = target.getDeliveryFee() == null ? platformDeliveryFee : target.getDeliveryFee();
        BigDecimal addMore = min.subtract(cartValue).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        if (addMore.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        result.put("addMoreForCheaperDelivery", addMore);
        result.put("nextDeliveryFee", fee.setScale(2, RoundingMode.HALF_UP));
        result.put("nextDeliveryAtOrderValue", min.setScale(2, RoundingMode.HALF_UP));
    }

    private List<Map<String, Object>> normalizeSlabs(
            List<UpdateTownConfigRequest.DeliverySlabRequest> input,
            String mode) {
        if (!MODE_SLAB.equals(mode)) {
            return List.of();
        }
        if (input == null || input.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Add at least one delivery slab for SLAB mode");
        }

        List<UpdateTownConfigRequest.DeliverySlabRequest> sorted = new ArrayList<>(input);
        sorted.sort(Comparator.comparing(
                s -> s.getMinOrderValue() == null ? BigDecimal.ZERO : s.getMinOrderValue()));

        List<Map<String, Object>> out = new ArrayList<>();
        BigDecimal prevMax = null;
        for (int i = 0; i < sorted.size(); i++) {
            UpdateTownConfigRequest.DeliverySlabRequest slab = sorted.get(i);
            BigDecimal min = slab.getMinOrderValue() == null ? BigDecimal.ZERO : slab.getMinOrderValue();
            BigDecimal max = slab.getMaxOrderValue();
            BigDecimal fee = slab.getDeliveryFee();
            if (fee == null || fee.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Each slab needs a deliveryFee >= 0");
            }
            if (min.compareTo(BigDecimal.ZERO) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Slab minOrderValue must be >= 0");
            }
            if (max != null && max.compareTo(min) < 0) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Slab maxOrderValue must be >= minOrderValue");
            }
            if (i == sorted.size() - 1 && max != null) {
                // allow last slab to have max, or open-ended — either is fine
            }
            if (prevMax != null && min.compareTo(prevMax) <= 0) {
                // soft overlap check: next min should be > previous max when previous has max
                // allow equality at boundary (e.g. 0-499, 500-null)
                if (min.compareTo(prevMax) < 0) {
                    throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Delivery slabs overlap");
                }
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("minOrderValue", min.setScale(2, RoundingMode.HALF_UP));
            row.put("maxOrderValue", max == null ? null : max.setScale(2, RoundingMode.HALF_UP));
            row.put("deliveryFee", fee.setScale(2, RoundingMode.HALF_UP));
            out.add(row);
            prevMax = max;
        }
        return out;
    }

    private TownOperationalConfigResponse defaultOperational() {
        return TownOperationalConfigResponse.builder()
                .minOrderValue(DEFAULT_MIN_ORDER)
                .deliveryMode(MODE_DEFAULT)
                .deliverySlabs(List.of())
                .themeColor(DEFAULT_THEME_COLOR)
                .bestDealsEnabled(true)
                .dealPrices(defaultDealPrices())
                .platformFee(BigDecimal.ZERO)
                .scratchCardEnabled(false)
                .scratchRewardMin(DEFAULT_SCRATCH_MIN)
                .scratchRewardMax(DEFAULT_SCRATCH_MAX)
                .scratchMinGoodsAmount(DEFAULT_SCRATCH_Z)
                .buyerMembershipEnabled(true)
                .codEnabled(true)
                .upiEnabled(true)
                .codCharge(BigDecimal.ZERO)
                .deliveryWindowStart(DEFAULT_WINDOW_START)
                .deliveryWindowEnd(DEFAULT_WINDOW_END)
                .laundryEnabled(false)
                .beautyEnabled(false)
                .buyerCancelOrderEnabled(true)
                .buyerCancelItemsEnabled(true)
                .build();
    }

    /** Effective buyer cancel flags (platform AND town). */
    @Transactional(readOnly = true)
    public Map<String, Object> buyerCancelPolicy(UUID townId) {
        TownOperationalConfigResponse cfg = getOperationalConfig(townId);
        boolean cancelOrder = platformSettingsService.buyerCancelOrderEnabled() && cfg.isBuyerCancelOrderEnabled();
        boolean cancelItems = platformSettingsService.buyerCancelItemsEnabled() && cfg.isBuyerCancelItemsEnabled();
        return Map.of(
                "cancelOrderEnabled", cancelOrder,
                "cancelItemsEnabled", cancelItems);
    }

    private Map<String, Object> defaultConfigValue() {
        Map<String, Object> value = new LinkedHashMap<>();
        value.put("minOrderValue", DEFAULT_MIN_ORDER);
        value.put("deliveryMode", MODE_DEFAULT);
        value.put("deliverySlabs", List.of());
        value.put("readyForPickupAlertHours", 1);
        value.put("refundWorkingDays", 5);
        value.put("maxSmsPerOrder", 6);
        value.put("quietHours", Map.of("start", "22:00", "end", "08:00"));
        value.put("themeColor", DEFAULT_THEME_COLOR);
        value.put("bestDealsEnabled", true);
        value.put("dealPrices", defaultDealPrices());
        value.put("platformFee", BigDecimal.ZERO);
        value.put("scratchCardEnabled", false);
        value.put("scratchRewardMin", DEFAULT_SCRATCH_MIN);
        value.put("scratchRewardMax", DEFAULT_SCRATCH_MAX);
        value.put("scratchMinGoodsAmount", DEFAULT_SCRATCH_Z);
        value.put("buyerMembershipEnabled", true);
        value.put("codEnabled", true);
        value.put("upiEnabled", true);
        value.put("codCharge", BigDecimal.ZERO);
        value.put("deliveryWindowStart", DEFAULT_WINDOW_START);
        value.put("deliveryWindowEnd", DEFAULT_WINDOW_END);
        value.put("laundryEnabled", false);
        value.put("beautyEnabled", false);
        value.put("buyerCancelOrderEnabled", true);
        value.put("buyerCancelItemsEnabled", true);
        return value;
    }

    private static void applyDeliveryWindow(Map<String, Object> value, UpdateTownConfigRequest request) {
        if (request.getDeliveryWindowStart() == null && request.getDeliveryWindowEnd() == null) {
            return;
        }
        String start = requireWindow(request.getDeliveryWindowStart(), "Delivery window start");
        String end = requireWindow(request.getDeliveryWindowEnd(), "Delivery window end");
        if (start.compareTo(end) >= 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Delivery window start must be before the end");
        }
        value.put("deliveryWindowStart", start);
        value.put("deliveryWindowEnd", end);
    }

    private static String requireWindow(String raw, String label) {
        String value = raw == null ? "" : raw.trim();
        if (value.length() >= 5) {
            value = value.substring(0, 5);
        }
        if (!WINDOW_HHMM.matcher(value).matches()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " must be a time like 17:00");
        }
        return value;
    }

    private static String readWindow(Map<String, Object> value, String key, String fallback) {
        if (value == null || value.get(key) == null) {
            return fallback;
        }
        String raw = String.valueOf(value.get(key)).trim();
        return WINDOW_HHMM.matcher(raw).matches() ? raw : fallback;
    }

    private TownOperationalConfigResponse toOperational(TownConfig config) {
        Map<String, Object> value = config.getConfigValue();
        Object minOrder = value != null ? value.get("minOrderValue") : null;
        BigDecimal minOrderValue = minOrder instanceof Number number
                ? BigDecimal.valueOf(number.doubleValue())
                : DEFAULT_MIN_ORDER;

        String mode = MODE_DEFAULT;
        if (value != null && value.get("deliveryMode") != null) {
            mode = String.valueOf(value.get("deliveryMode")).trim().toUpperCase();
            if (!MODE_SLAB.equals(mode)) {
                mode = MODE_DEFAULT;
            }
        }

        List<TownOperationalConfigResponse.DeliverySlabResponse> slabs = new ArrayList<>();
        if (value != null && value.get("deliverySlabs") instanceof List<?> rawList) {
            for (Object item : rawList) {
                if (!(item instanceof Map<?, ?> map)) continue;
                slabs.add(TownOperationalConfigResponse.DeliverySlabResponse.builder()
                        .minOrderValue(asDecimal(map.get("minOrderValue")))
                        .maxOrderValue(asDecimal(map.get("maxOrderValue")))
                        .deliveryFee(asDecimal(map.get("deliveryFee")))
                        .build());
            }
        }

        Map<String, ScratchServiceRules.Rule> scratchRules = ScratchServiceRules.read(value);
        Map<String, TownOperationalConfigResponse.ScratchServiceRuleResponse> scratchByService = new LinkedHashMap<>();
        for (Map.Entry<String, ScratchServiceRules.Rule> entry : scratchRules.entrySet()) {
            ScratchServiceRules.Rule rule = entry.getValue();
            scratchByService.put(entry.getKey(), TownOperationalConfigResponse.ScratchServiceRuleResponse.builder()
                    .enabled(rule.enabled())
                    .rewardMin(rule.rewardMin())
                    .rewardMax(rule.rewardMax())
                    .minOrderAmount(rule.minOrderAmount())
                    .prepayModeFilter(rule.prepayModeFilter().name())
                    .issueAfterRating(rule.issueAfterRating())
                    .partialPrepayEnabled(rule.partialPrepayEnabled())
                    .partialRewardMin(rule.partialRewardMin())
                    .partialRewardMax(rule.partialRewardMax())
                    .partialMinPrepayAmount(rule.partialMinPrepayAmount())
                    .rewardDisplayMax(rule.rewardDisplayMax())
                    .partialRewardDisplayMax(rule.partialRewardDisplayMax())
                    .build());
        }
        ScratchServiceRules.Rule groceryScratch = scratchRules.get(ScratchServiceKind.GROCERY.name());

        return TownOperationalConfigResponse.builder()
                .minOrderValue(minOrderValue)
                .deliveryMode(mode)
                .deliverySlabs(slabs)
                .themeColor(readThemeColor(value))
                .bestDealsEnabled(readBestDealsEnabled(value))
                .dealPrices(readDealPrices(value))
                .platformFee(readPlatformFee(value))
                .scratchCardEnabled(groceryScratch != null && groceryScratch.enabled())
                .scratchRewardMin(groceryScratch != null ? groceryScratch.rewardMin() : DEFAULT_SCRATCH_MIN)
                .scratchRewardMax(groceryScratch != null ? groceryScratch.rewardMax() : DEFAULT_SCRATCH_MAX)
                .scratchMinGoodsAmount(groceryScratch != null ? groceryScratch.minOrderAmount() : DEFAULT_SCRATCH_Z)
                .scratchByService(scratchByService)
                .buyerMembershipEnabled(readBuyerMembershipEnabled(value))
                .codEnabled(readCodEnabled(value))
                .upiEnabled(readUpiEnabled(value))
                .codCharge(readCodCharge(value))
                .deliveryWindowStart(readWindow(value, "deliveryWindowStart", DEFAULT_WINDOW_START))
                .deliveryWindowEnd(readWindow(value, "deliveryWindowEnd", DEFAULT_WINDOW_END))
                .laundryEnabled(readLaundryEnabled(value))
                .beautyEnabled(readBeautyEnabled(value))
                .beautyMinPrepayAmount(readBeautyMinPrepayAmount(value))
                .beautyParlourPaymentFee(readBeautyParlourPaymentFee(value))
                .buyerCancelOrderEnabled(readBuyerCancelOrderEnabled(value))
                .buyerCancelItemsEnabled(readBuyerCancelItemsEnabled(value))
                .build();
    }

    public TownShopSettingsResponse toShopSettings(UUID townId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        TownOperationalConfigResponse cfg = getOperationalConfig(townId);
        TownOperationalConfigResponse.ScratchServiceRuleResponse beautyScratch = cfg.getScratchByService() == null
                ? null
                : cfg.getScratchByService().get("BEAUTY");
        return TownShopSettingsResponse.builder()
                .themeColor(cfg.getThemeColor())
                .bestDealsEnabled(cfg.isBestDealsEnabled())
                .dealPrices(cfg.getDealPrices())
                .platformFee(cfg.getPlatformFee())
                .codEnabled(cfg.isCodEnabled())
                .upiEnabled(cfg.isUpiEnabled())
                .codCharge(cfg.getCodCharge())
                .deliveryWindowStart(cfg.getDeliveryWindowStart())
                .deliveryWindowEnd(cfg.getDeliveryWindowEnd())
                .laundryEnabled(cfg.isLaundryEnabled())
                .beautyEnabled(cfg.isBeautyEnabled())
                .beautyMinPrepayAmount(cfg.getBeautyMinPrepayAmount())
                .beautyParlourPaymentFee(cfg.getBeautyParlourPaymentFee())
                .beautyScratchEnabled(beautyScratch != null && beautyScratch.isEnabled())
                .beautyScratchPrepayFilter(beautyScratch == null || beautyScratch.getPrepayModeFilter() == null
                        ? "BOTH"
                        : beautyScratch.getPrepayModeFilter())
                .beautyScratchRewardMax(beautyScratch == null || beautyScratch.getRewardMax() == null
                        ? BigDecimal.ZERO
                        : beautyScratch.getRewardMax())
                .beautyScratchRewardMin(beautyScratch == null || beautyScratch.getRewardMin() == null
                        ? BigDecimal.ZERO
                        : beautyScratch.getRewardMin())
                .beautyScratchMinOrderAmount(beautyScratch == null || beautyScratch.getMinOrderAmount() == null
                        ? BigDecimal.ZERO
                        : beautyScratch.getMinOrderAmount())
                .beautyScratchPartialEnabled(beautyScratch != null && beautyScratch.isPartialPrepayEnabled())
                .beautyScratchPartialRewardMax(beautyScratch == null || beautyScratch.getPartialRewardMax() == null
                        ? BigDecimal.ZERO
                        : beautyScratch.getPartialRewardMax())
                .beautyScratchPartialRewardMin(beautyScratch == null || beautyScratch.getPartialRewardMin() == null
                        ? BigDecimal.ZERO
                        : beautyScratch.getPartialRewardMin())
                .beautyScratchPartialMinPrepayAmount(
                        beautyScratch == null || beautyScratch.getPartialMinPrepayAmount() == null
                                ? BigDecimal.ZERO
                                : beautyScratch.getPartialMinPrepayAmount())
                .beautyScratchRewardDisplayMax(beautyScratch == null
                        ? BigDecimal.ZERO
                        : ScratchServiceRules.effectiveDisplayMax(
                                beautyScratch.getRewardDisplayMax(), beautyScratch.getRewardMax()))
                .beautyScratchPartialRewardDisplayMax(beautyScratch == null || !beautyScratch.isPartialPrepayEnabled()
                        ? BigDecimal.ZERO
                        : ScratchServiceRules.effectiveDisplayMax(
                                beautyScratch.getPartialRewardDisplayMax(), beautyScratch.getPartialRewardMax()))
                .build();
    }

    private void applyBeautyPaymentSettings(Map<String, Object> value, UpdateTownConfigRequest request) {
        if (request.getBeautyMinPrepayAmount() != null) {
            value.put("beautyMinPrepayAmount", normalizeNonNegativeMoney(request.getBeautyMinPrepayAmount()));
        }
        if (request.getBeautyParlourPaymentFee() != null) {
            value.put("beautyParlourPaymentFee", normalizeNonNegativeMoney(request.getBeautyParlourPaymentFee()));
        }
    }

    private static BigDecimal normalizeNonNegativeMoney(BigDecimal raw) {
        if (raw == null || raw.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Amount must be ₹0 or more");
        }
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal readBeautyMinPrepayAmount(Map<String, Object> value) {
        return readMoney(value, "beautyMinPrepayAmount", BigDecimal.ZERO);
    }

    private BigDecimal readBeautyParlourPaymentFee(Map<String, Object> value) {
        return readMoney(value, "beautyParlourPaymentFee", BigDecimal.ZERO);
    }

    private void applyPaymentSettings(Map<String, Object> value, UpdateTownConfigRequest request) {
        boolean codEnabled = request.getCodEnabled() != null
                ? request.getCodEnabled()
                : readCodEnabled(value);
        boolean upiEnabled = request.getUpiEnabled() != null
                ? request.getUpiEnabled()
                : readUpiEnabled(value);
        BigDecimal codCharge = request.getCodCharge() != null
                ? normalizeCodCharge(request.getCodCharge())
                : readCodCharge(value);
        if (!codEnabled && !upiEnabled) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Enable at least one payment method (COD or UPI)");
        }
        value.put("codEnabled", codEnabled);
        value.put("upiEnabled", upiEnabled);
        value.put("codCharge", codCharge);
    }

    static BigDecimal normalizeCodCharge(BigDecimal raw) {
        if (raw == null || raw.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "COD charge must be ₹0 or more");
        }
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private static boolean readLaundryEnabled(Map<String, Object> value) {
        if (value == null || value.get("laundryEnabled") == null) {
            return false;
        }
        return truthy(value.get("laundryEnabled"));
    }

    private static boolean readBeautyEnabled(Map<String, Object> value) {
        if (value == null || value.get("beautyEnabled") == null) {
            return false;
        }
        return truthy(value.get("beautyEnabled"));
    }

    private static boolean readCodEnabled(Map<String, Object> value) {
        if (value == null || value.get("codEnabled") == null) {
            return true;
        }
        return truthy(value.get("codEnabled"));
    }

    private static boolean readUpiEnabled(Map<String, Object> value) {
        if (value == null || value.get("upiEnabled") == null) {
            return true;
        }
        return truthy(value.get("upiEnabled"));
    }

    private BigDecimal readCodCharge(Map<String, Object> value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal n = asDecimal(value.get("codCharge"));
        if (n == null || n.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO;
        }
        return n.setScale(2, RoundingMode.HALF_UP);
    }

    private static String readThemeColor(Map<String, Object> value) {
        if (value == null || value.get("themeColor") == null) {
            return DEFAULT_THEME_COLOR;
        }
        try {
            return normalizeThemeColor(String.valueOf(value.get("themeColor")));
        } catch (BusinessException ignored) {
            return DEFAULT_THEME_COLOR;
        }
    }

    private static boolean readBestDealsEnabled(Map<String, Object> value) {
        if (value == null || value.get("bestDealsEnabled") == null) {
            return true;
        }
        Object raw = value.get("bestDealsEnabled");
        if (raw instanceof Boolean b) {
            return b;
        }
        return !"false".equalsIgnoreCase(String.valueOf(raw).trim());
    }

    private static List<Integer> defaultDealPrices() {
        return List.of(19, 29, 49, 99);
    }

    private static List<Integer> readDealPrices(Map<String, Object> value) {
        if (value == null || !(value.get("dealPrices") instanceof List<?> raw)) {
            return defaultDealPrices();
        }
        try {
            return normalizeDealPrices(raw);
        } catch (BusinessException ignored) {
            return defaultDealPrices();
        }
    }

    static List<Integer> normalizeDealPrices(List<?> raw) {
        if (raw == null || raw.size() != 4) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Enter exactly 4 deal prices");
        }
        List<Integer> out = new ArrayList<>(4);
        for (Object item : raw) {
            Integer n = asWholeRupees(item);
            if (n == null || n < 1) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Each deal price must be a whole number ≥ 1");
            }
            out.add(n);
        }
        return List.copyOf(out);
    }

    private BigDecimal readPlatformFee(Map<String, Object> value) {
        if (value == null) {
            return BigDecimal.ZERO;
        }
        BigDecimal n = asDecimal(value.get("platformFee"));
        if (n == null || n.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO;
        }
        return n.setScale(2, RoundingMode.HALF_UP);
    }

    static BigDecimal normalizePlatformFee(BigDecimal raw) {
        if (raw == null || raw.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Platform fee must be ₹0 or more");
        }
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private void applyScratchCard(Map<String, Object> value, UpdateTownConfigRequest request) {
        Map<String, ScratchServiceRules.Rule> rules = ScratchServiceRules.read(value);
        if (request.getScratchByService() != null && !request.getScratchByService().isEmpty()) {
            for (Map.Entry<String, Map<String, Object>> entry : request.getScratchByService().entrySet()) {
                ScratchServiceKind kind = ScratchServiceKind.parse(entry.getKey());
                String key = kind.name();
                Map<String, Object> patch = entry.getValue();
                if (patch == null || patch.isEmpty()) {
                    continue;
                }
                ScratchServiceRules.Rule base = rules.get(key);
                if (base == null) {
                    base = rules.get(ScratchServiceKind.GROCERY.name());
                }
                ScratchServiceRules.Rule merged = ScratchServiceRules.Rule.builder()
                        .enabled(patchBool(patch, "enabled", base.enabled()))
                        .rewardMin(patchMoney(patch, "rewardMin", base.rewardMin()))
                        .rewardMax(patchMoney(patch, "rewardMax", base.rewardMax()))
                        .minOrderAmount(patchMoney(patch, "minOrderAmount", base.minOrderAmount()))
                        .prepayModeFilter(patch.containsKey("prepayModeFilter") && patch.get("prepayModeFilter") != null
                                ? ScratchPrepayModeFilter.parse(String.valueOf(patch.get("prepayModeFilter")))
                                : base.prepayModeFilter())
                        .issueAfterRating(patchBool(patch, "issueAfterRating", base.issueAfterRating()))
                        .partialPrepayEnabled(resolvePartialPrepayEnabled(patch, base))
                        .partialRewardMin(patchMoney(patch, "partialRewardMin", base.partialRewardMin()))
                        .partialRewardMax(patchMoney(patch, "partialRewardMax", base.partialRewardMax()))
                        .partialMinPrepayAmount(patchMoney(patch, "partialMinPrepayAmount", base.partialMinPrepayAmount()))
                        .rewardDisplayMax(patchMoney(patch, "rewardDisplayMax", base.rewardDisplayMax()))
                        .partialRewardDisplayMax(
                                patchMoney(patch, "partialRewardDisplayMax", base.partialRewardDisplayMax()))
                        .build();
                if (kind == ScratchServiceKind.BEAUTY) {
                    merged = syncBeautyScratchPrepayFlags(merged);
                }
                rules.put(key, ScratchServiceRules.normalize(merged, scratchServiceLabel(kind)));
            }
        }
        boolean legacyTouch = request.getScratchCardEnabled() != null
                || request.getScratchRewardMin() != null
                || request.getScratchRewardMax() != null
                || request.getScratchMinGoodsAmount() != null;
        if (legacyTouch) {
            ScratchServiceRules.Rule grocery = rules.get(ScratchServiceKind.GROCERY.name());
            boolean enabled = request.getScratchCardEnabled() != null
                    ? request.getScratchCardEnabled()
                    : grocery.enabled();
            BigDecimal min = request.getScratchRewardMin() != null
                    ? normalizeScratchMoney(request.getScratchRewardMin(), "Reward min")
                    : grocery.rewardMin();
            BigDecimal max = request.getScratchRewardMax() != null
                    ? normalizeScratchMoney(request.getScratchRewardMax(), "Reward max")
                    : grocery.rewardMax();
            BigDecimal threshold = request.getScratchMinGoodsAmount() != null
                    ? normalizeScratchMoney(request.getScratchMinGoodsAmount(), "Min goods amount")
                    : grocery.minOrderAmount();
            ScratchServiceRules.Rule merged = ScratchServiceRules.Rule.builder()
                    .enabled(enabled)
                    .rewardMin(min)
                    .rewardMax(max)
                    .minOrderAmount(threshold)
                    .prepayModeFilter(grocery.prepayModeFilter())
                    .issueAfterRating(grocery.issueAfterRating())
                    .partialPrepayEnabled(grocery.partialPrepayEnabled())
                    .partialRewardMin(grocery.partialRewardMin())
                    .partialRewardMax(grocery.partialRewardMax())
                    .partialMinPrepayAmount(grocery.partialMinPrepayAmount())
                    .rewardDisplayMax(grocery.rewardDisplayMax())
                    .partialRewardDisplayMax(grocery.partialRewardDisplayMax())
                    .build();
            rules.put(
                    ScratchServiceKind.GROCERY.name(),
                    ScratchServiceRules.normalize(merged, scratchServiceLabel(ScratchServiceKind.GROCERY)));
        }
        ScratchServiceRules.write(value, rules);
    }

    private static String scratchServiceLabel(ScratchServiceKind kind) {
        return switch (kind) {
            case GROCERY -> "Grocery scratch";
            case LAUNDRY -> "Laundry scratch";
            case BEAUTY -> "Glam scratch";
        };
    }

    private static boolean resolvePartialPrepayEnabled(Map<String, Object> patch, ScratchServiceRules.Rule base) {
        if (patch.containsKey("partialPrepayEnabled") && patch.get("partialPrepayEnabled") != null) {
            return ScratchServiceRules.readBoolValue(patch.get("partialPrepayEnabled"), false);
        }
        if (patch.containsKey("prepayModeFilter") && patch.get("prepayModeFilter") != null) {
            ScratchPrepayModeFilter filter =
                    ScratchPrepayModeFilter.parse(String.valueOf(patch.get("prepayModeFilter")));
            if (filter == ScratchPrepayModeFilter.PARTIAL || filter == ScratchPrepayModeFilter.BOTH) {
                return true;
            }
            if (filter == ScratchPrepayModeFilter.FULL) {
                return false;
            }
        }
        return base.partialPrepayEnabled();
    }

    private static boolean patchBool(Map<String, Object> patch, String key, boolean fallback) {
        if (!patch.containsKey(key) || patch.get(key) == null) {
            return fallback;
        }
        return ScratchServiceRules.readBoolValue(patch.get(key), fallback);
    }

    private static BigDecimal patchMoney(Map<String, Object> patch, String key, BigDecimal fallback) {
        if (!patch.containsKey(key) || patch.get(key) == null) {
            return fallback;
        }
        Object raw = patch.get(key);
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new BigDecimal(s.trim()).setScale(2, RoundingMode.HALF_UP);
        }
        if (raw instanceof BigDecimal bd) {
            return bd.setScale(2, RoundingMode.HALF_UP);
        }
        return fallback;
    }

    /** Keep prepay filter and partial toggle aligned when admins save glam scratch rules. */
    private static ScratchServiceRules.Rule syncBeautyScratchPrepayFlags(ScratchServiceRules.Rule merged) {
        ScratchPrepayModeFilter filter = merged.prepayModeFilter() == null
                ? ScratchPrepayModeFilter.BOTH
                : merged.prepayModeFilter();
        boolean fullPay = ScratchServiceRules.fullPayScratchEnabled(filter);
        boolean partialPay = merged.partialPrepayEnabled() || filter == ScratchPrepayModeFilter.PARTIAL;
        ScratchPrepayModeFilter syncedFilter = ScratchServiceRules.derivePrepayFilter(fullPay, partialPay);
        return ScratchServiceRules.Rule.builder()
                .enabled(merged.enabled())
                .rewardMin(merged.rewardMin())
                .rewardMax(merged.rewardMax())
                .minOrderAmount(merged.minOrderAmount())
                .prepayModeFilter(syncedFilter)
                .issueAfterRating(merged.issueAfterRating())
                .partialPrepayEnabled(partialPay)
                .partialRewardMin(merged.partialRewardMin())
                .partialRewardMax(merged.partialRewardMax())
                .partialMinPrepayAmount(merged.partialMinPrepayAmount())
                .rewardDisplayMax(merged.rewardDisplayMax())
                .partialRewardDisplayMax(merged.partialRewardDisplayMax())
                .build();
    }

    private static boolean readBuyerMembershipEnabled(Map<String, Object> value) {
        if (value == null || value.get("buyerMembershipEnabled") == null) {
            return true;
        }
        Object raw = value.get("buyerMembershipEnabled");
        if (raw instanceof Boolean b) {
            return b;
        }
        return !"false".equalsIgnoreCase(String.valueOf(raw).trim());
    }

    private static boolean readBuyerCancelOrderEnabled(Map<String, Object> value) {
        if (value == null || value.get("buyerCancelOrderEnabled") == null) {
            return true;
        }
        return truthy(value.get("buyerCancelOrderEnabled"));
    }

    private static boolean readBuyerCancelItemsEnabled(Map<String, Object> value) {
        if (value == null || value.get("buyerCancelItemsEnabled") == null) {
            return true;
        }
        return truthy(value.get("buyerCancelItemsEnabled"));
    }

    private static boolean readScratchCardEnabled(Map<String, Object> value) {
        if (value == null || value.get("scratchCardEnabled") == null) {
            return false;
        }
        Object raw = value.get("scratchCardEnabled");
        if (raw instanceof Boolean b) {
            return b;
        }
        return "true".equalsIgnoreCase(String.valueOf(raw).trim());
    }

    private BigDecimal readMoney(Map<String, Object> value, String key, BigDecimal fallback) {
        if (value == null) {
            return fallback;
        }
        BigDecimal n = asDecimal(value.get(key));
        if (n == null || n.compareTo(BigDecimal.ZERO) < 0) {
            return fallback;
        }
        return n.setScale(2, RoundingMode.HALF_UP);
    }

    static BigDecimal normalizeScratchMoney(BigDecimal raw, String label) {
        if (raw == null || raw.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " must be ₹0 or more");
        }
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private static Integer asWholeRupees(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number n) {
            return n.intValue();
        }
        if (raw instanceof String s && !s.isBlank()) {
            try {
                return Integer.parseInt(s.trim());
            } catch (NumberFormatException ignored) {
                return null;
            }
        }
        return null;
    }

    static String normalizeThemeColor(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "themeColor is required");
        }
        String hex = raw.trim();
        if (!hex.startsWith("#")) {
            hex = "#" + hex;
        }
        hex = hex.toUpperCase();
        if (!hex.matches("^#[0-9A-F]{6}$")) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "themeColor must be a hex color like #009111");
        }
        return hex;
    }

    private BigDecimal asDecimal(Object raw) {
        if (raw == null) return null;
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).setScale(2, RoundingMode.HALF_UP);
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new BigDecimal(s.trim()).setScale(2, RoundingMode.HALF_UP);
        }
        return null;
    }

    static List<String> settingsChangeParts(Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> left = before != null ? before : Map.of();
        Map<String, Object> right = after != null ? after : Map.of();
        List<String> parts = new ArrayList<>();
        addMoneyChange(parts, "Min order", left.get("minOrderValue"), right.get("minOrderValue"));
        addMoneyChange(parts, "Platform fee", left.get("platformFee"), right.get("platformFee"));
        addPlainChange(parts, "Delivery mode", left.get("deliveryMode"), right.get("deliveryMode"));
        addPlainChange(parts, "Delivery window start", left.get("deliveryWindowStart"), right.get("deliveryWindowStart"));
        addPlainChange(parts, "Delivery window end", left.get("deliveryWindowEnd"), right.get("deliveryWindowEnd"));
        addPlainChange(parts, "Theme color", left.get("themeColor"), right.get("themeColor"));
        addBoolChange(parts, "Best deals", left.get("bestDealsEnabled"), right.get("bestDealsEnabled"));
        addBoolChange(parts, "Buyer membership", left.get("buyerMembershipEnabled"), right.get("buyerMembershipEnabled"));
        addBoolChange(parts, "Scratch card", left.get("scratchCardEnabled"), right.get("scratchCardEnabled"));
        if (!Objects.equals(stringify(left.get(ScratchServiceRules.MAP_KEY)), stringify(right.get(ScratchServiceRules.MAP_KEY)))) {
            parts.add("Scratch by service updated");
        }
        addBoolChange(parts, "Laundry", left.get("laundryEnabled"), right.get("laundryEnabled"));
        addBoolChange(parts, "Beauty", left.get("beautyEnabled"), right.get("beautyEnabled"));
        addBoolChange(parts, "Buyer cancel order", left.get("buyerCancelOrderEnabled"), right.get("buyerCancelOrderEnabled"));
        addBoolChange(parts, "Buyer cancel items", left.get("buyerCancelItemsEnabled"), right.get("buyerCancelItemsEnabled"));
        addBoolChange(parts, "COD", left.get("codEnabled"), right.get("codEnabled"));
        addBoolChange(parts, "UPI / online pay", left.get("upiEnabled"), right.get("upiEnabled"));
        addMoneyChange(parts, "COD charge", left.get("codCharge"), right.get("codCharge"));
        if (!Objects.equals(stringify(left.get("dealPrices")), stringify(right.get("dealPrices")))) {
            parts.add("Deal prices: " + summarizeDealPrices(left.get("dealPrices"))
                    + " → " + summarizeDealPrices(right.get("dealPrices")));
        }
        if (!Objects.equals(stringify(left.get("deliverySlabs")), stringify(right.get("deliverySlabs")))) {
            parts.add("Delivery slabs: " + summarizeDeliverySlabs(left.get("deliverySlabs"))
                    + " → " + summarizeDeliverySlabs(right.get("deliverySlabs")));
        }
        return parts;
    }

    static String settingsChangeSummary(String townName, Map<String, Object> before, Map<String, Object> after) {
        List<String> parts = settingsChangeParts(before, after);
        String body = parts.isEmpty() ? "Updated settings" : String.join("; ", parts);
        String prefix = townName == null || townName.isBlank() ? "" : townName.trim() + " · ";
        String summary = prefix + body;
        return summary.length() <= 500 ? summary : summary.substring(0, 500);
    }

    private static void addMoneyChange(List<String> parts, String label, Object before, Object after) {
        String left = moneyLabel(before);
        String right = moneyLabel(after);
        if (!Objects.equals(left, right)) {
            parts.add(label + " " + left + " → " + right);
        }
    }

    private static void addPlainChange(List<String> parts, String label, Object before, Object after) {
        String left = stringify(before);
        String right = stringify(after);
        if (!Objects.equals(left, right)) {
            parts.add(label + " " + left + " → " + right);
        }
    }

    private static void addBoolChange(List<String> parts, String label, Object before, Object after) {
        if (Objects.equals(normalizeBool(before), normalizeBool(after))) {
            return;
        }
        parts.add(label + " " + boolLabel(before) + " → " + boolLabel(after));
    }

    private static Boolean normalizeBool(Object raw) {
        if (raw == null) {
            return null;
        }
        return truthy(raw);
    }

    private static String boolLabel(Object raw) {
        if (raw == null) {
            return "not set";
        }
        return truthy(raw) ? "on" : "off";
    }

    private static String summarizeDealPrices(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return "not set";
        }
        List<String> prices = new ArrayList<>();
        for (Object item : list) {
            Integer n = asWholeRupees(item);
            if (n != null) {
                prices.add("₹" + n);
            }
        }
        return prices.isEmpty() ? "not set" : String.join(", ", prices);
    }

    private static String summarizeDeliverySlabs(Object raw) {
        if (!(raw instanceof List<?> list) || list.isEmpty()) {
            return "none";
        }
        List<String> parts = new ArrayList<>();
        for (Object item : list) {
            if (!(item instanceof Map<?, ?> map)) {
                continue;
            }
            String min = moneyLabel(map.get("minOrderValue"));
            Object maxRaw = map.get("maxOrderValue");
            String max = maxRaw == null ? "∞" : moneyLabel(maxRaw);
            String fee = moneyLabel(map.get("deliveryFee"));
            parts.add(min + "–" + max + " @ " + fee);
        }
        return parts.isEmpty() ? "none" : String.join("; ", parts);
    }

    private static boolean truthy(Object raw) {
        if (raw instanceof Boolean b) {
            return b;
        }
        return "true".equalsIgnoreCase(stringify(raw));
    }

    private static String moneyLabel(Object raw) {
        if (raw == null) {
            return "—";
        }
        try {
            BigDecimal n = raw instanceof Number num
                    ? BigDecimal.valueOf(num.doubleValue())
                    : new BigDecimal(String.valueOf(raw));
            n = n.setScale(0, RoundingMode.HALF_UP);
            return "₹" + n.toPlainString();
        } catch (NumberFormatException ex) {
            return stringify(raw);
        }
    }

    private static String stringify(Object raw) {
        return raw == null ? "—" : String.valueOf(raw);
    }
}
