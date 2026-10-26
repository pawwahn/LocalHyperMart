package com.hyperlocalmart.common.beauty;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Per-day staff capacity overrides (JSON map date → count). */
public final class BeautyStaffOverrides {

    private static final Pattern ENTRY = Pattern.compile("\"?(\\d{4}-\\d{2}-\\d{2})\"?\\s*:\\s*(\\d+)");

    private BeautyStaffOverrides() {
    }

    public static int clampStaff(int value) {
        return Math.max(1, Math.min(50, value));
    }

    public static int effective(int defaultStaff, String rawOverrides, LocalDate day) {
        if (day == null) {
            return clampStaff(defaultStaff);
        }
        Integer override = parse(rawOverrides).get(day);
        return clampStaff(override != null ? override : defaultStaff);
    }

    public static Map<LocalDate, Integer> parse(String raw) {
        Map<LocalDate, Integer> map = new LinkedHashMap<>();
        if (raw == null || raw.isBlank()) {
            return map;
        }
        Matcher matcher = ENTRY.matcher(raw.trim());
        while (matcher.find()) {
            LocalDate date = LocalDate.parse(matcher.group(1));
            map.put(date, clampStaff(Integer.parseInt(matcher.group(2))));
        }
        return map;
    }

    public static String serialize(Map<LocalDate, Integer> map) {
        if (map == null || map.isEmpty()) {
            return "{}";
        }
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<LocalDate, Integer> entry : map.entrySet()) {
            if (entry.getKey() == null || entry.getValue() == null) {
                continue;
            }
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(entry.getKey()).append("\":").append(clampStaff(entry.getValue()));
        }
        sb.append('}');
        return sb.toString();
    }

    public static String putOverride(String raw, LocalDate day, Integer staffCount, int defaultStaff) {
        Map<LocalDate, Integer> map = parse(raw);
        if (day == null) {
            return serialize(map);
        }
        if (staffCount == null || clampStaff(staffCount) == clampStaff(defaultStaff)) {
            map.remove(day);
        } else {
            map.put(day, clampStaff(staffCount));
        }
        return serialize(map);
    }
}
