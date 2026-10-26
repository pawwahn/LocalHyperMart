package com.hyperlocalmart.common.beauty;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/** Vendor-specific IST appointment grid (open → close, fixed interval). */
public record BeautySlotSchedule(LocalTime dayOpen, LocalTime dayClose, int intervalMinutes) {

    public static final ZoneId IST = ZoneId.of("Asia/Kolkata");
    private static final DateTimeFormatter HM = DateTimeFormatter.ofPattern("HH:mm");
    private static final BeautySlotSchedule DEFAULT = new BeautySlotSchedule(LocalTime.of(8, 0), LocalTime.of(20, 0), 45);

    public BeautySlotSchedule {
        dayOpen = dayOpen == null ? DEFAULT.dayOpen : dayOpen;
        dayClose = dayClose == null ? DEFAULT.dayClose : dayClose;
        intervalMinutes = intervalMinutes < 1 ? DEFAULT.intervalMinutes : intervalMinutes;
    }

    public static BeautySlotSchedule defaults() {
        return DEFAULT;
    }

    public static BeautySlotSchedule parse(String open, String close, Integer intervalMinutes) {
        LocalTime o = parseTime(open, DEFAULT.dayOpen);
        LocalTime c = parseTime(close, DEFAULT.dayClose);
        int mins = intervalMinutes == null ? DEFAULT.intervalMinutes : intervalMinutes;
        return normalize(o, c, mins);
    }

    /** Like {@link #parse} but never throws — used when listing artists so one bad row cannot break the town. */
    public static BeautySlotSchedule parseSafe(String open, String close, Integer intervalMinutes) {
        try {
            return parse(open, close, intervalMinutes);
        } catch (IllegalArgumentException ex) {
            return defaults();
        }
    }

    public static BeautySlotSchedule normalize(LocalTime open, LocalTime close, int intervalMinutes) {
        int interval = clampInterval(intervalMinutes);
        LocalTime dayOpen = open == null ? DEFAULT.dayOpen : open;
        LocalTime dayClose = close == null ? DEFAULT.dayClose : close;
        if (!dayOpen.isBefore(dayClose)) {
            throw new IllegalArgumentException("Open time must be before close time");
        }
        int openMin = dayOpen.getHour() * 60 + dayOpen.getMinute();
        int closeMin = dayClose.getHour() * 60 + dayClose.getMinute();
        if (openMin + interval > closeMin) {
            throw new IllegalArgumentException("Schedule must allow at least one slot");
        }
        return new BeautySlotSchedule(dayOpen, dayClose, interval);
    }

    public static int clampInterval(int minutes) {
        if (minutes <= 15) {
            return 15;
        }
        if (minutes <= 30) {
            return 30;
        }
        if (minutes <= 45) {
            return 45;
        }
        return 60;
    }

    public String dayOpenText() {
        return dayOpen.format(HM);
    }

    public String dayCloseText() {
        return dayClose.format(HM);
    }

    public Set<String> allIds() {
        LinkedHashSet<String> ids = new LinkedHashSet<>();
        int cursor = dayOpen.getHour() * 60 + dayOpen.getMinute();
        int lastStart = dayClose.getHour() * 60 + dayClose.getMinute() - intervalMinutes;
        while (cursor <= lastStart) {
            int h = cursor / 60;
            int m = cursor % 60;
            ids.add(String.format("%02d%02d", h, m));
            cursor += intervalMinutes;
        }
        return Set.copyOf(ids);
    }

    public boolean isValidId(String raw) {
        if (raw == null || raw.isBlank()) {
            return false;
        }
        String id = raw.trim();
        return allIds().contains(id);
    }

    public String idFromInstant(Instant start) {
        if (start == null) {
            return "";
        }
        ZonedDateTime zdt = start.atZone(IST);
        return String.format("%02d%02d", zdt.getHour(), zdt.getMinute());
    }

    public Instant slotInstant(LocalDate day, String slotId) {
        if (day == null || !isValidId(slotId)) {
            return null;
        }
        int hour = Integer.parseInt(slotId.substring(0, 2));
        int minute = Integer.parseInt(slotId.substring(2, 4));
        return day.atTime(hour, minute).atZone(IST).toInstant();
    }

    public boolean aligns(Instant start) {
        if (start == null) {
            return false;
        }
        String id = idFromInstant(start);
        if (!isValidId(id)) {
            return false;
        }
        LocalDate day = start.atZone(IST).toLocalDate();
        return Objects.equals(start, slotInstant(day, id));
    }

    /** Parses {@code HH:mm} or {@code HH:mm:ss} (browser time inputs). */
    public static LocalTime parseLocalTime(String raw, LocalTime fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String token = raw.trim();
        try {
            if (token.length() >= 8 && token.charAt(2) == ':' && token.charAt(5) == ':') {
                return LocalTime.parse(token.substring(0, 8));
            }
            return LocalTime.parse(token, HM);
        } catch (Exception ex) {
            return fallback;
        }
    }

    private static LocalTime parseTime(String raw, LocalTime fallback) {
        return parseLocalTime(raw, fallback);
    }
}
