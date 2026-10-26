package com.hyperlocalmart.town.scratch;

import java.util.Locale;

/** Glam checkout prepay filter for scratch card eligibility. */
public enum ScratchPrepayModeFilter {
    BOTH,
    FULL,
    PARTIAL;

    public static ScratchPrepayModeFilter parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return BOTH;
        }
        try {
            return ScratchPrepayModeFilter.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return BOTH;
        }
    }
}
