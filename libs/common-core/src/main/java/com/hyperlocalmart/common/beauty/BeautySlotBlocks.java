package com.hyperlocalmart.common.beauty;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Per-day manual slot blocks (JSON map {@code YYYY-MM-DD -> "1100,1130"}). */
public final class BeautySlotBlocks {

    private static final Pattern DATE = Pattern.compile("\"?(\\d{4}-\\d{2}-\\d{2})\"?\\s*:\\s*\"([^\"]*)\"");

    private BeautySlotBlocks() {
    }

    public static Set<String> forDate(String raw, LocalDate day, BeautySlotSchedule schedule) {
        if (day == null) {
            return Set.of();
        }
        String slots = parse(raw).get(day);
        if (slots == null || slots.isBlank()) {
            return Set.of();
        }
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String part : slots.split(",")) {
            String id = part.trim();
            if (!id.isEmpty() && schedule.isValidId(id)) {
                out.add(id);
            }
        }
        return Set.copyOf(out);
    }

    public static Map<LocalDate, String> parse(String raw) {
        Map<LocalDate, String> map = new LinkedHashMap<>();
        if (raw == null || raw.isBlank() || raw.trim().equals("{}")) {
            return map;
        }
        Matcher matcher = DATE.matcher(raw.trim());
        while (matcher.find()) {
            map.put(LocalDate.parse(matcher.group(1)), matcher.group(2).trim());
        }
        return map;
    }

    public static String serialize(Map<LocalDate, String> map) {
        if (map == null || map.isEmpty()) {
            return "{}";
        }
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<LocalDate, String> entry : map.entrySet()) {
            if (entry.getKey() == null) {
                continue;
            }
            String slots = entry.getValue() == null ? "" : entry.getValue().trim();
            if (!first) {
                sb.append(',');
            }
            first = false;
            sb.append('"').append(entry.getKey()).append("\":\"").append(slots.replace("\"", "")).append('"');
        }
        sb.append('}');
        return sb.toString();
    }

    public static String putForDate(String raw, LocalDate day, String slotIdsCsv, BeautySlotSchedule schedule) {
        Map<LocalDate, String> map = parse(raw);
        if (day == null) {
            return serialize(map);
        }
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        if (slotIdsCsv != null && !slotIdsCsv.isBlank()) {
            for (String part : slotIdsCsv.split(",")) {
                String id = part.trim();
                if (!id.isEmpty() && schedule.isValidId(id)) {
                    ids.add(id);
                }
            }
        }
        if (ids.isEmpty()) {
            map.remove(day);
        } else {
            map.put(day, String.join(",", ids));
        }
        return serialize(map);
    }
}
