package com.hyperlocalmart.town.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Field-level old → new lines for town hub/agent pay audit (screen_key = town-incentives). */
final class DeliveryPayoutAuditFormat {

    private DeliveryPayoutAuditFormat() {}

    static List<String> changeParts(Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> left = before == null ? Map.of() : before;
        Map<String, Object> right = after == null ? Map.of() : after;
        if (left.isEmpty() && right.isEmpty()) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        if (!Objects.equals(left.get("townAdminCanEditAgentRates"), right.get("townAdminCanEditAgentRates"))) {
            lines.add(
                    "Hub can edit agent ₹: "
                            + onOff(left.get("townAdminCanEditAgentRates"))
                            + " → "
                            + onOff(right.get("townAdminCanEditAgentRates")));
        }
        diffParty("Agent", asMap(left.get("agent")), asMap(right.get("agent")), lines);
        diffParty("Hub", asMap(left.get("hub")), asMap(right.get("hub")), lines);
        return lines;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object raw) {
        if (raw instanceof Map<?, ?> map) {
            return (Map<String, Object>) map;
        }
        return Map.of();
    }

    private static void diffParty(
            String partyLabel, Map<String, Object> before, Map<String, Object> after, List<String> lines) {
        if (before.isEmpty() && after.isEmpty()) {
            return;
        }
        if (!Objects.equals(before.get("enabled"), after.get("enabled"))) {
            lines.add(partyLabel + " pay: " + onOff(before.get("enabled")) + " → " + onOff(after.get("enabled")));
        }
        diffPerOrder(partyLabel, asMap(before.get("perOrder")), asMap(after.get("perOrder")), lines);
        diffPeriod(partyLabel, "Daily", asMap(before.get("perDay")), asMap(after.get("perDay")), lines);
        diffPeriod(partyLabel, "Monthly", asMap(before.get("perMonth")), asMap(after.get("perMonth")), lines);
        diffSlabs(partyLabel, asMap(before.get("slabs")), asMap(after.get("slabs")), lines);
        if ("Hub".equals(partyLabel)) {
            diffFranchise(asMap(before.get("franchise")), asMap(after.get("franchise")), lines);
        }
    }

    private static void diffPerOrder(
            String partyLabel, Map<String, Object> before, Map<String, Object> after, List<String> lines) {
        if (!Objects.equals(before.get("enabled"), after.get("enabled"))) {
            lines.add(
                    partyLabel + " per-order pay: "
                            + onOff(before.get("enabled"))
                            + " → "
                            + onOff(after.get("enabled")));
        }
        diffMoneyLine(lines, partyLabel + " · Vendor → hub", before.get("pickupAmount"), after.get("pickupAmount"));
        diffMoneyLine(lines, partyLabel + " · Return → shop", before.get("lastMileAmount"), after.get("lastMileAmount"));
        diffMoneyLine(
                lines,
                partyLabel + " · To customer",
                before.get("completedOrderAmount"),
                after.get("completedOrderAmount"));
    }

    private static void diffPeriod(
            String partyLabel,
            String periodLabel,
            Map<String, Object> before,
            Map<String, Object> after,
            List<String> lines) {
        if (!Objects.equals(before.get("enabled"), after.get("enabled"))) {
            lines.add(
                    partyLabel + " " + periodLabel + " bonus: "
                            + onOff(before.get("enabled"))
                            + " → "
                            + onOff(after.get("enabled")));
        }
        diffMoneyLine(lines, partyLabel + " " + periodLabel + " ₹", before.get("amount"), after.get("amount"));
        diffIntLine(
                lines,
                partyLabel + " " + periodLabel + " min orders",
                before.get("minCompletedOrders"),
                after.get("minCompletedOrders"));
    }

    private static void diffSlabs(
            String partyLabel, Map<String, Object> before, Map<String, Object> after, List<String> lines) {
        if (!Objects.equals(before.get("enabled"), after.get("enabled"))) {
            lines.add(
                    partyLabel + " volume slabs: "
                            + onOff(before.get("enabled"))
                            + " → "
                            + onOff(after.get("enabled")));
        }
        diffPlainLine(lines, partyLabel + " slab period", before.get("period"), after.get("period"));
        diffPlainLine(lines, partyLabel + " slab metric", before.get("metric"), after.get("metric"));
        diffPlainLine(lines, partyLabel + " slab payout type", before.get("payout"), after.get("payout"));
        diffSlabTiers(partyLabel, before.get("tiers"), after.get("tiers"), lines);
    }

    private static void diffSlabTiers(String partyLabel, Object beforeTiers, Object afterTiers, List<String> lines) {
        List<Map<String, Object>> left = tierList(beforeTiers);
        List<Map<String, Object>> right = tierList(afterTiers);
        int n = Math.max(left.size(), right.size());
        for (int i = 0; i < n; i++) {
            Map<String, Object> b = i < left.size() ? left.get(i) : Map.of();
            Map<String, Object> a = i < right.size() ? right.get(i) : Map.of();
            String range = slabRangeLabel(b, a);
            diffMoneyLine(lines, partyLabel + " slab " + range, b.get("amount"), a.get("amount"));
            diffIntLine(lines, partyLabel + " slab " + range + " min", b.get("minCount"), a.get("minCount"));
            diffIntLine(lines, partyLabel + " slab " + range + " max", b.get("maxCount"), a.get("maxCount"));
        }
    }

    private static List<Map<String, Object>> tierList(Object raw) {
        if (!(raw instanceof List<?> list)) {
            return List.of();
        }
        List<Map<String, Object>> out = new ArrayList<>();
        for (Object item : list) {
            out.add(asMap(item));
        }
        return out;
    }

    private static String slabRangeLabel(Map<String, Object> before, Map<String, Object> after) {
        int min = Math.max(0, asInt(before.get("minCount"), asInt(after.get("minCount"), 0)));
        Integer max = intOrNull(before.get("maxCount"));
        if (max == null) {
            max = intOrNull(after.get("maxCount"));
        }
        if (max == null) {
            return min + "+";
        }
        return min + "–" + max;
    }

    private static void diffFranchise(Map<String, Object> before, Map<String, Object> after, List<String> lines) {
        if (!Objects.equals(before.get("enabled"), after.get("enabled"))) {
            lines.add(
                    "Hub franchise: " + onOff(before.get("enabled")) + " → " + onOff(after.get("enabled")));
        }
        diffMoneyLine(lines, "Hub franchise ₹", before.get("amount"), after.get("amount"));
        diffPlainLine(lines, "Hub franchise cadence", before.get("cadence"), after.get("cadence"));
        diffPlainLine(lines, "Hub franchise billing start", before.get("effectiveFrom"), after.get("effectiveFrom"));
    }

    private static void diffMoneyLine(List<String> lines, String label, Object before, Object after) {
        if (moneyEqual(before, after)) {
            return;
        }
        lines.add(label + ": " + moneyLabel(before) + " → " + moneyLabel(after));
    }

    private static void diffIntLine(List<String> lines, String label, Object before, Object after) {
        if (Objects.equals(normalizeInt(before), normalizeInt(after))) {
            return;
        }
        lines.add(label + ": " + intLabel(before) + " → " + intLabel(after));
    }

    private static Object normalizeInt(Object raw) {
        if (raw == null) {
            return null;
        }
        return intOrNull(raw);
    }

    private static String intLabel(Object raw) {
        if (raw == null) {
            return "—";
        }
        Integer n = intOrNull(raw);
        return n == null ? "—" : String.valueOf(n);
    }

    private static void diffPlainLine(List<String> lines, String label, Object before, Object after) {
        if (Objects.equals(scalar(before), scalar(after))) {
            return;
        }
        lines.add(label + ": " + scalar(before) + " → " + scalar(after));
    }

    private static boolean moneyEqual(Object before, Object after) {
        return moneyLabel(before).equals(moneyLabel(after));
    }

    private static String moneyLabel(Object raw) {
        if (raw == null) {
            return "—";
        }
        BigDecimal n = toMoney(raw);
        return "₹" + n.setScale(2, RoundingMode.HALF_UP).toPlainString();
    }

    private static BigDecimal toMoney(Object raw) {
        if (raw instanceof BigDecimal bd) {
            return bd.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        }
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue()).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        }
        try {
            return new BigDecimal(String.valueOf(raw).trim()).max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
    }

    private static String onOff(Object raw) {
        if (raw instanceof Boolean b) {
            return b ? "on" : "off";
        }
        if (raw == null) {
            return "off";
        }
        return "true".equalsIgnoreCase(String.valueOf(raw).trim()) ? "on" : "off";
    }

    private static int asInt(Object raw, int fallback) {
        if (raw == null) {
            return fallback;
        }
        if (raw instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(raw).trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }

    private static Integer intOrNull(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(raw).trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static String scalar(Object raw) {
        if (raw == null) {
            return "—";
        }
        String s = String.valueOf(raw).trim();
        return s.isEmpty() ? "—" : s;
    }
}
