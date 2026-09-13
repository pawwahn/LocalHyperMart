package com.hyperlocalmart.town.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.request.UpdateTownConfigRequest;
import com.hyperlocalmart.town.dto.response.TownOperationalConfigResponse;
import com.hyperlocalmart.town.dto.response.TownShopSettingsResponse;
import com.hyperlocalmart.town.entity.TownConfig;
import com.hyperlocalmart.town.repository.TownConfigRepository;
import com.hyperlocalmart.town.repository.TownRepository;
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

@Service
@RequiredArgsConstructor
public class TownConfigService {

    private static final String OPERATIONAL_KEY = "operational";
    private static final BigDecimal DEFAULT_MIN_ORDER = new BigDecimal("199");
    private static final String DEFAULT_THEME_COLOR = "#0C831F";
    private static final String MODE_DEFAULT = "DEFAULT";
    private static final String MODE_SLAB = "SLAB";
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
     * Buyer nudge: how much more cart value to reach the cheapest cheaper slab (₹0 / ₹1 when configured).
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
            if (fee.compareTo(BigDecimal.ONE) > 0) {
                continue;
            }
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
                .build();
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
        return value;
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

        return TownOperationalConfigResponse.builder()
                .minOrderValue(minOrderValue)
                .deliveryMode(mode)
                .deliverySlabs(slabs)
                .themeColor(readThemeColor(value))
                .bestDealsEnabled(readBestDealsEnabled(value))
                .dealPrices(readDealPrices(value))
                .platformFee(readPlatformFee(value))
                .scratchCardEnabled(readScratchCardEnabled(value))
                .scratchRewardMin(readMoney(value, "scratchRewardMin", DEFAULT_SCRATCH_MIN))
                .scratchRewardMax(readMoney(value, "scratchRewardMax", DEFAULT_SCRATCH_MAX))
                .scratchMinGoodsAmount(readMoney(value, "scratchMinGoodsAmount", DEFAULT_SCRATCH_Z))
                .buyerMembershipEnabled(readBuyerMembershipEnabled(value))
                .build();
    }

    public TownShopSettingsResponse toShopSettings(UUID townId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
        TownOperationalConfigResponse cfg = getOperationalConfig(townId);
        return TownShopSettingsResponse.builder()
                .themeColor(cfg.getThemeColor())
                .bestDealsEnabled(cfg.isBestDealsEnabled())
                .dealPrices(cfg.getDealPrices())
                .platformFee(cfg.getPlatformFee())
                .build();
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
        boolean enabled = request.getScratchCardEnabled() != null
                ? request.getScratchCardEnabled()
                : readScratchCardEnabled(value);
        BigDecimal min = request.getScratchRewardMin() != null
                ? normalizeScratchMoney(request.getScratchRewardMin(), "Reward min")
                : readMoney(value, "scratchRewardMin", DEFAULT_SCRATCH_MIN);
        BigDecimal max = request.getScratchRewardMax() != null
                ? normalizeScratchMoney(request.getScratchRewardMax(), "Reward max")
                : readMoney(value, "scratchRewardMax", DEFAULT_SCRATCH_MAX);
        BigDecimal threshold = request.getScratchMinGoodsAmount() != null
                ? normalizeScratchMoney(request.getScratchMinGoodsAmount(), "Min goods amount")
                : readMoney(value, "scratchMinGoodsAmount", DEFAULT_SCRATCH_Z);
        if (max.compareTo(min) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Scratch reward max must be ≥ min");
        }
        if (enabled && (min.compareTo(BigDecimal.ONE) < 0 || threshold.compareTo(BigDecimal.ONE) < 0)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Scratch card needs reward min, max, and goods threshold of ₹1 or more");
        }
        value.put("scratchCardEnabled", enabled);
        value.put("scratchRewardMin", min);
        value.put("scratchRewardMax", max);
        value.put("scratchMinGoodsAmount", threshold);
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
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "themeColor must be a hex color like #0C831F");
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

    static String settingsChangeSummary(String townName, Map<String, Object> before, Map<String, Object> after) {
        List<String> parts = new ArrayList<>();
        addMoneyChange(parts, "min order", before.get("minOrderValue"), after.get("minOrderValue"));
        addMoneyChange(parts, "platform fee", before.get("platformFee"), after.get("platformFee"));
        addPlainChange(parts, "delivery", before.get("deliveryMode"), after.get("deliveryMode"));
        addPlainChange(parts, "theme", before.get("themeColor"), after.get("themeColor"));
        addBoolChange(parts, "best deals", before.get("bestDealsEnabled"), after.get("bestDealsEnabled"));
        addBoolChange(parts, "buyer membership", before.get("buyerMembershipEnabled"), after.get("buyerMembershipEnabled"));
        addBoolChange(parts, "scratch card", before.get("scratchCardEnabled"), after.get("scratchCardEnabled"));
        if (!Objects.equals(stringify(before.get("dealPrices")), stringify(after.get("dealPrices")))) {
            parts.add("deal prices changed");
        }
        if (!Objects.equals(stringify(before.get("deliverySlabs")), stringify(after.get("deliverySlabs")))) {
            parts.add("delivery slabs changed");
        }
        String body = parts.isEmpty() ? "Updated settings" : String.join(", ", parts);
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
        if (Objects.equals(stringify(before), stringify(after))) {
            return;
        }
        parts.add(label + " " + (truthy(after) ? "on" : "off"));
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
