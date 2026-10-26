package com.hyperlocalmart.town.scratch;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.Builder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

/** Per-service scratch card rules stored under operational config `scratchByService`. */
public final class ScratchServiceRules {

    public static final String MAP_KEY = "scratchByService";

    private ScratchServiceRules() {
    }

    @Builder
    public record Rule(
            boolean enabled,
            BigDecimal rewardMin,
            BigDecimal rewardMax,
            BigDecimal minOrderAmount,
            ScratchPrepayModeFilter prepayModeFilter,
            boolean issueAfterRating,
            boolean partialPrepayEnabled,
            BigDecimal partialRewardMin,
            BigDecimal partialRewardMax,
            BigDecimal partialMinPrepayAmount,
            /** Buyer promo only; actual payout still uses rewardMax. Zero = show rewardMax. */
            BigDecimal rewardDisplayMax,
            BigDecimal partialRewardDisplayMax) {
    }

    public static BigDecimal effectiveDisplayMax(BigDecimal displayMax, BigDecimal payoutMax) {
        if (displayMax != null && displayMax.compareTo(BigDecimal.ZERO) > 0) {
            return displayMax.setScale(2, RoundingMode.HALF_UP);
        }
        return payoutMax == null ? BigDecimal.ZERO : payoutMax.setScale(2, RoundingMode.HALF_UP);
    }

    public static ScratchPrepayModeFilter derivePrepayFilter(boolean fullPayScratch, boolean partialPrepayScratch) {
        if (fullPayScratch && partialPrepayScratch) {
            return ScratchPrepayModeFilter.BOTH;
        }
        if (fullPayScratch) {
            return ScratchPrepayModeFilter.FULL;
        }
        if (partialPrepayScratch) {
            return ScratchPrepayModeFilter.PARTIAL;
        }
        return ScratchPrepayModeFilter.FULL;
    }

    public static boolean fullPayScratchEnabled(ScratchPrepayModeFilter filter) {
        return filter == null
                || filter == ScratchPrepayModeFilter.BOTH
                || filter == ScratchPrepayModeFilter.FULL;
    }

    public static Map<String, Rule> fromLegacyTownMap(Map<String, Object> value) {
        boolean enabled = readBool(value, "scratchCardEnabled", false);
        BigDecimal min = readMoney(value, "scratchRewardMin", new BigDecimal("10.00"));
        BigDecimal max = readMoney(value, "scratchRewardMax", new BigDecimal("50.00"));
        BigDecimal threshold = readMoney(value, "scratchMinGoodsAmount", new BigDecimal("499.00"));
        Rule grocery = Rule.builder()
                .enabled(enabled)
                .rewardMin(min)
                .rewardMax(max)
                .minOrderAmount(threshold)
                .prepayModeFilter(ScratchPrepayModeFilter.BOTH)
                .issueAfterRating(false)
                .partialPrepayEnabled(false)
                .partialRewardMin(min)
                .partialRewardMax(max)
                .partialMinPrepayAmount(threshold)
                .rewardDisplayMax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .partialRewardDisplayMax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .build();
        Map<String, Rule> map = new LinkedHashMap<>();
        map.put(ScratchServiceKind.GROCERY.name(), grocery);
        map.put(ScratchServiceKind.LAUNDRY.name(), disabledDefaults(ScratchServiceKind.LAUNDRY));
        map.put(ScratchServiceKind.BEAUTY.name(), disabledDefaults(ScratchServiceKind.BEAUTY));
        return map;
    }

    public static Map<String, Rule> read(Map<String, Object> value) {
        if (value == null) {
            return fromLegacyTownMap(Map.of());
        }
        Object raw = value.get(MAP_KEY);
        if (!(raw instanceof Map<?, ?> byService)) {
            return fromLegacyTownMap(value);
        }
        Map<String, Rule> out = fromLegacyTownMap(value);
        for (ScratchServiceKind kind : ScratchServiceKind.values()) {
            Object row = byService.get(kind.name());
            if (row instanceof Map<?, ?> map) {
                out.put(kind.name(), readRule(map, out.get(kind.name())));
            }
        }
        return out;
    }

    public static void write(Map<String, Object> value, Map<String, Rule> rules) {
        Map<String, Object> stored = new LinkedHashMap<>();
        for (Map.Entry<String, Rule> entry : rules.entrySet()) {
            Rule rule = entry.getValue();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("enabled", rule.enabled());
            row.put("rewardMin", rule.rewardMin());
            row.put("rewardMax", rule.rewardMax());
            row.put("minOrderAmount", rule.minOrderAmount());
            row.put("prepayModeFilter", rule.prepayModeFilter().name());
            row.put("issueAfterRating", rule.issueAfterRating());
            row.put("partialPrepayEnabled", rule.partialPrepayEnabled());
            row.put("partialRewardMin", rule.partialRewardMin());
            row.put("partialRewardMax", rule.partialRewardMax());
            row.put("partialMinPrepayAmount", rule.partialMinPrepayAmount());
            row.put("rewardDisplayMax", rule.rewardDisplayMax());
            row.put("partialRewardDisplayMax", rule.partialRewardDisplayMax());
            stored.put(entry.getKey(), row);
        }
        value.put(MAP_KEY, stored);
        Rule grocery = rules.get(ScratchServiceKind.GROCERY.name());
        if (grocery != null) {
            value.put("scratchCardEnabled", grocery.enabled());
            value.put("scratchRewardMin", grocery.rewardMin());
            value.put("scratchRewardMax", grocery.rewardMax());
            value.put("scratchMinGoodsAmount", grocery.minOrderAmount());
        }
    }

    public static Rule normalize(Rule draft, String label) {
        BigDecimal min = money(draft.rewardMin(), "Reward min for " + label);
        BigDecimal max = money(draft.rewardMax(), "Reward max for " + label);
        BigDecimal threshold = money(draft.minOrderAmount(), "Order threshold for " + label);
        if (max.compareTo(min) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + ": reward max must be ≥ min");
        }
        if (draft.enabled() && (min.compareTo(BigDecimal.ONE) < 0 || threshold.compareTo(BigDecimal.ONE) < 0)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    label + ": enable needs min reward and order threshold of ₹1 or more");
        }
        BigDecimal partialMin = money(draft.partialRewardMin(), "Partial reward min");
        BigDecimal partialMax = money(draft.partialRewardMax(), "Partial reward max");
        BigDecimal partialThreshold = money(draft.partialMinPrepayAmount(), "Partial prepay threshold");
        if (partialMax.compareTo(partialMin) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + ": partial reward max must be ≥ min");
        }
        if (draft.partialPrepayEnabled()
                && draft.enabled()
                && (partialMin.compareTo(BigDecimal.ONE) < 0 || partialThreshold.compareTo(BigDecimal.ONE) < 0)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    label + ": partial prepay needs min reward and prepay threshold of ₹1 or more");
        }
        return Rule.builder()
                .enabled(draft.enabled())
                .rewardMin(min)
                .rewardMax(max)
                .minOrderAmount(threshold)
                .prepayModeFilter(draft.prepayModeFilter() == null ? ScratchPrepayModeFilter.BOTH : draft.prepayModeFilter())
                .issueAfterRating(draft.issueAfterRating())
                .partialPrepayEnabled(draft.partialPrepayEnabled())
                .partialRewardMin(partialMin)
                .partialRewardMax(partialMax)
                .partialMinPrepayAmount(partialThreshold)
                .rewardDisplayMax(optionalDisplayMoney(draft.rewardDisplayMax()))
                .partialRewardDisplayMax(optionalDisplayMoney(draft.partialRewardDisplayMax()))
                .build();
    }

    public static Map<String, Object> toResponseMap(Map<String, Rule> rules) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Map.Entry<String, Rule> entry : rules.entrySet()) {
            Rule rule = entry.getValue();
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("enabled", rule.enabled());
            row.put("rewardMin", rule.rewardMin());
            row.put("rewardMax", rule.rewardMax());
            row.put("minOrderAmount", rule.minOrderAmount());
            row.put("prepayModeFilter", rule.prepayModeFilter().name());
            row.put("issueAfterRating", rule.issueAfterRating());
            row.put("partialPrepayEnabled", rule.partialPrepayEnabled());
            row.put("partialRewardMin", rule.partialRewardMin());
            row.put("partialRewardMax", rule.partialRewardMax());
            row.put("partialMinPrepayAmount", rule.partialMinPrepayAmount());
            row.put("rewardDisplayMax", rule.rewardDisplayMax());
            row.put("partialRewardDisplayMax", rule.partialRewardDisplayMax());
            out.put(entry.getKey(), row);
        }
        return out;
    }

    private static Rule readRule(Map<?, ?> map, Rule fallback) {
        boolean enabled = map.get("enabled") != null ? readBool(map, "enabled", false) : fallback.enabled();
        BigDecimal min = map.get("rewardMin") != null
                ? readMoney(map, "rewardMin", fallback.rewardMin())
                : fallback.rewardMin();
        BigDecimal max = map.get("rewardMax") != null
                ? readMoney(map, "rewardMax", fallback.rewardMax())
                : fallback.rewardMax();
        BigDecimal threshold = map.get("minOrderAmount") != null
                ? readMoney(map, "minOrderAmount", fallback.minOrderAmount())
                : fallback.minOrderAmount();
        ScratchPrepayModeFilter prepay = map.get("prepayModeFilter") != null
                ? ScratchPrepayModeFilter.parse(String.valueOf(map.get("prepayModeFilter")))
                : fallback.prepayModeFilter();
        boolean issueAfterRating = map.get("issueAfterRating") != null
                ? readBool(map, "issueAfterRating", fallback.issueAfterRating())
                : fallback.issueAfterRating();
        boolean partialEnabled = map.get("partialPrepayEnabled") != null
                ? readBool(map, "partialPrepayEnabled", false)
                : inferPartialPrepayEnabled(prepay, fallback.partialPrepayEnabled());
        BigDecimal partialMin = map.get("partialRewardMin") != null
                ? readMoney(map, "partialRewardMin", fallback.partialRewardMin())
                : fallback.partialRewardMin();
        BigDecimal partialMax = map.get("partialRewardMax") != null
                ? readMoney(map, "partialRewardMax", fallback.partialRewardMax())
                : fallback.partialRewardMax();
        BigDecimal partialThreshold = map.get("partialMinPrepayAmount") != null
                ? readMoney(map, "partialMinPrepayAmount", fallback.partialMinPrepayAmount())
                : fallback.partialMinPrepayAmount();
        BigDecimal displayMax = map.get("rewardDisplayMax") != null
                ? readOptionalDisplayMoney(map, "rewardDisplayMax", fallback.rewardDisplayMax())
                : fallback.rewardDisplayMax();
        BigDecimal partialDisplayMax = map.get("partialRewardDisplayMax") != null
                ? readOptionalDisplayMoney(map, "partialRewardDisplayMax", fallback.partialRewardDisplayMax())
                : fallback.partialRewardDisplayMax();
        return Rule.builder()
                .enabled(enabled)
                .rewardMin(min)
                .rewardMax(max)
                .minOrderAmount(threshold)
                .prepayModeFilter(prepay)
                .issueAfterRating(issueAfterRating)
                .partialPrepayEnabled(partialEnabled)
                .partialRewardMin(partialMin)
                .partialRewardMax(partialMax)
                .partialMinPrepayAmount(partialThreshold)
                .rewardDisplayMax(displayMax)
                .partialRewardDisplayMax(partialDisplayMax)
                .build();
    }

    private static Rule disabledDefaults(ScratchServiceKind kind) {
        return Rule.builder()
                .enabled(false)
                .rewardMin(new BigDecimal("10.00"))
                .rewardMax(new BigDecimal("50.00"))
                .minOrderAmount(new BigDecimal("499.00"))
                .prepayModeFilter(ScratchPrepayModeFilter.BOTH)
                .issueAfterRating(kind == ScratchServiceKind.BEAUTY)
                .partialPrepayEnabled(false)
                .partialRewardMin(new BigDecimal("10.00"))
                .partialRewardMax(new BigDecimal("50.00"))
                .partialMinPrepayAmount(new BigDecimal("499.00"))
                .rewardDisplayMax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .partialRewardDisplayMax(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP))
                .build();
    }

    private static BigDecimal optionalDisplayMoney(BigDecimal raw) {
        if (raw == null || raw.compareTo(BigDecimal.ZERO) < 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal readOptionalDisplayMoney(Map<?, ?> map, String key, BigDecimal fallback) {
        Object raw = map.get(key);
        BigDecimal n = asDecimal(raw);
        if (n == null || n.compareTo(BigDecimal.ZERO) < 0) {
            return fallback == null ? BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP) : fallback;
        }
        return n.setScale(2, RoundingMode.HALF_UP);
    }

    private static boolean readBool(Map<?, ?> map, String key, boolean fallback) {
        return readBoolValue(map.get(key), fallback);
    }

    static boolean inferPartialPrepayEnabled(ScratchPrepayModeFilter prepayFilter, boolean fallback) {
        if (prepayFilter == ScratchPrepayModeFilter.PARTIAL || prepayFilter == ScratchPrepayModeFilter.BOTH) {
            return true;
        }
        return fallback;
    }

    public static boolean readBoolValue(Object raw, boolean fallback) {
        if (raw instanceof Boolean b) {
            return b;
        }
        if (raw instanceof Number n) {
            return n.intValue() != 0;
        }
        if (raw == null) {
            return fallback;
        }
        String text = String.valueOf(raw).trim();
        if ("true".equalsIgnoreCase(text) || "1".equals(text)) {
            return true;
        }
        if ("false".equalsIgnoreCase(text) || "0".equals(text)) {
            return false;
        }
        return fallback;
    }

    private static BigDecimal readMoney(Map<?, ?> map, String key, BigDecimal fallback) {
        Object raw = map.get(key);
        BigDecimal n = asDecimal(raw);
        if (n == null || n.compareTo(BigDecimal.ZERO) < 0) {
            return fallback;
        }
        return n.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal money(BigDecimal raw, String label) {
        if (raw == null || raw.compareTo(BigDecimal.ZERO) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, label + " must be ₹0 or more");
        }
        return raw.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal asDecimal(Object raw) {
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new BigDecimal(s.trim());
        }
        return null;
    }
}
