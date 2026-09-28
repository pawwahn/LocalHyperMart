package com.hyperlocalmart.town.service;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Field-level diffs for super-admin catalog audit rows (screen_key = catalog). */
final class CatalogAuditFormat {

    private static final List<String> KEY_ORDER = List.of(
            "name",
            "categoryName",
            "unitCode",
            "mrp",
            "hsnCode",
            "gstPercent",
            "cessPercent",
            "priceIncludesTax",
            "countryOfOrigin",
            "description");

    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("name", "Name"),
            Map.entry("description", "Description"),
            Map.entry("categoryName", "Category"),
            Map.entry("unitCode", "Unit"),
            Map.entry("mrp", "MRP"),
            Map.entry("hsnCode", "HSN"),
            Map.entry("gstPercent", "GST %"),
            Map.entry("cessPercent", "Cess %"),
            Map.entry("priceIncludesTax", "Price includes tax"),
            Map.entry("countryOfOrigin", "Country of origin"));

    private CatalogAuditFormat() {}

    static List<String> changeParts(Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> left = before == null ? Map.of() : before;
        Map<String, Object> right = after == null ? Map.of() : after;
        if (left.isEmpty() && right.isEmpty()) {
            return List.of();
        }
        LinkedHashMap<String, Object> keys = new LinkedHashMap<>();
        KEY_ORDER.forEach(k -> keys.put(k, null));
        left.keySet().forEach(k -> keys.put(k, null));
        right.keySet().forEach(k -> keys.put(k, null));

        List<String> lines = new ArrayList<>();
        for (String key : keys.keySet()) {
            Object a = left.get(key);
            Object b = right.get(key);
            if (valuesEqual(a, b)) {
                continue;
            }
            String label = LABELS.getOrDefault(key, key);
            lines.add(label + ": " + pretty(key, a) + " → " + pretty(key, b));
        }
        return lines;
    }

    static List<String> summaryTail(String summary) {
        if (summary == null || summary.isBlank()) {
            return List.of();
        }
        int idx = summary.indexOf(';');
        if (idx < 0 || idx >= summary.length() - 1) {
            return List.of();
        }
        String tail = summary.substring(idx + 1).trim();
        if (tail.isEmpty()) {
            return List.of();
        }
        List<String> parts = new ArrayList<>();
        for (String piece : tail.split(";\\s*")) {
            String line = piece.trim();
            if (!line.isEmpty()) {
                parts.add(line);
            }
        }
        return parts;
    }

    private static boolean valuesEqual(Object a, Object b) {
        if (Objects.equals(a, b)) {
            return true;
        }
        if (a == null || b == null) {
            return false;
        }
        if (a instanceof Number || b instanceof Number) {
            try {
                BigDecimal da = toDecimal(a);
                BigDecimal db = toDecimal(b);
                if (da != null && db != null) {
                    return da.compareTo(db) == 0;
                }
            } catch (NumberFormatException ignored) {
                // fall through
            }
        }
        return String.valueOf(a).equals(String.valueOf(b));
    }

    private static BigDecimal toDecimal(Object value) {
        if (value instanceof BigDecimal bd) {
            return bd;
        }
        if (value instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        return new BigDecimal(String.valueOf(value).trim());
    }

    private static String pretty(String key, Object raw) {
        if (raw == null) {
            return "—";
        }
        if (raw instanceof Boolean bool) {
            return bool ? "on" : "off";
        }
        if ("gstPercent".equals(key) || "cessPercent".equals(key)) {
            return toDecimal(raw).stripTrailingZeros().toPlainString() + "%";
        }
        if ("mrp".equals(key)) {
            return "₹" + toDecimal(raw).stripTrailingZeros().toPlainString();
        }
        String s = String.valueOf(raw).trim();
        return s.isEmpty() ? "—" : s;
    }
}
