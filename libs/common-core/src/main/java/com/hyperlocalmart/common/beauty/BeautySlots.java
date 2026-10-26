package com.hyperlocalmart.common.beauty;

import java.time.Instant;
import java.util.Set;

/** Default glam grid helpers (use {@link BeautySlotSchedule} when vendor settings apply). */
public final class BeautySlots {

    public static final int LEAD_HOURS = 1;

    private BeautySlots() {
    }

    public static Set<String> allIds() {
        return BeautySlotSchedule.defaults().allIds();
    }

    public static boolean isValidId(String raw) {
        return BeautySlotSchedule.defaults().isValidId(raw);
    }

    public static String idFromInstant(Instant start) {
        return BeautySlotSchedule.defaults().idFromInstant(start);
    }
}
