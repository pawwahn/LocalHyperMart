package com.hyperlocalmart.vendor.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Locale;

/**
 * Fits lab types in legacy {@code service_for VARCHAR(10)} ({@code PRIVATE_LAB} is 11 chars).
 */
@Converter
public class VendorServiceForConverter implements AttributeConverter<VendorServiceFor, String> {

    private static final String DB_PRIVATE_LAB = "PRIV_LAB";
    private static final String DB_HOSPITAL_LAB = "HOSP_LAB";

    @Override
    public String convertToDatabaseColumn(VendorServiceFor value) {
        if (value == null) {
            return null;
        }
        return switch (value) {
            case PRIVATE_LAB -> DB_PRIVATE_LAB;
            case HOSPITAL_LAB -> DB_HOSPITAL_LAB;
            default -> value.name();
        };
    }

    @Override
    public VendorServiceFor convertToEntityAttribute(String db) {
        if (db == null || db.isBlank()) {
            return VendorServiceFor.UNISEX;
        }
        String key = db.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        return switch (key) {
            case DB_PRIVATE_LAB, "PRIVATE_LAB", "PRIVATE", "PRIVATE_LA" -> VendorServiceFor.PRIVATE_LAB;
            case DB_HOSPITAL_LAB, "HOSPITAL_LAB", "HOSPITAL", "HOSPITAL_LA" -> VendorServiceFor.HOSPITAL_LAB;
            case "M", "MALE" -> VendorServiceFor.MALE;
            case "F", "FEMALE" -> VendorServiceFor.FEMALE;
            case "UNI", "UNISEX", "ALL" -> VendorServiceFor.UNISEX;
            default -> VendorServiceFor.UNISEX;
        };
    }
}
