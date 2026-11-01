package com.hyperlocalmart.vendor.entity;

import com.fasterxml.jackson.annotation.JsonCreator;

import java.util.Locale;

public enum VendorServiceFor {
    MALE,
    FEMALE,
    UNISEX;

    @JsonCreator
    public static VendorServiceFor parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String key = raw.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return switch (key) {
            case "M", "MALE" -> MALE;
            case "F", "FEMALE" -> FEMALE;
            case "UNI", "UNISEX", "ALL" -> UNISEX;
            default -> VendorServiceFor.valueOf(key);
        };
    }

    public String displayLabel() {
        return switch (this) {
            case MALE -> "Male";
            case FEMALE -> "Female";
            case UNISEX -> "Unisex";
        };
    }
}
