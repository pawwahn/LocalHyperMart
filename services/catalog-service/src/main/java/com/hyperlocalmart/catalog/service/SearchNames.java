package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/** Comma-separated alternate names used only for search. */
public final class SearchNames {

    public static final int MAX_LENGTH = 500;

    private SearchNames() {
    }

    /**
     * Trims, drops blanks, and keeps the first spelling of each name.
     * Blank input clears the field. Throws when the stored value would exceed {@link #MAX_LENGTH}.
     */
    public static String normalize(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        Map<String, String> unique = new LinkedHashMap<>();
        for (String part : raw.split(",")) {
            String trimmed = part.trim().replaceAll("\\s+", " ");
            if (trimmed.isEmpty()) {
                continue;
            }
            unique.putIfAbsent(trimmed.toLowerCase(Locale.ROOT), trimmed);
        }
        if (unique.isEmpty()) {
            return null;
        }
        String joined = String.join(", ", unique.values());
        if (joined.length() > MAX_LENGTH) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "Other names must be " + MAX_LENGTH + " characters or less");
        }
        return joined;
    }
}
