package com.hyperlocalmart.town.scratch;

import java.util.Locale;

public enum ScratchServiceKind {
    GROCERY,
    LAUNDRY,
    BEAUTY;

    public static ScratchServiceKind parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return GROCERY;
        }
        try {
            return ScratchServiceKind.valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            return GROCERY;
        }
    }
}
