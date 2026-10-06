package com.hyperlocalmart.common.util;

import java.util.UUID;
import java.util.regex.Pattern;

/** Avoid showing raw UUIDs where a human label is expected. */
public final class DisplayNames {

    private static final Pattern UUID_LIKE =
            Pattern.compile("^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", Pattern.CASE_INSENSITIVE);

    private DisplayNames() {}

    public static boolean looksLikeUuid(String value) {
        if (value == null) {
            return false;
        }
        String trimmed = value.trim();
        return !trimmed.isEmpty() && UUID_LIKE.matcher(trimmed).matches();
    }

    public static boolean isHumanLabel(String value) {
        if (value == null) {
            return false;
        }
        String trimmed = value.trim();
        return !trimmed.isEmpty() && !looksLikeUuid(trimmed);
    }

    public static String firstHuman(String... candidates) {
        if (candidates == null) {
            return null;
        }
        for (String c : candidates) {
            if (isHumanLabel(c)) {
                return c.trim();
            }
        }
        return null;
    }

    public static String orFallback(String name, String fallback) {
        return isHumanLabel(name) ? name.trim() : fallback;
    }

    public static String orFallback(String name, UUID id, String fallback) {
        String human = firstHuman(name, id == null ? null : id.toString());
        return human != null ? human : fallback;
    }
}
