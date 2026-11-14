package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.vendor.entity.ServiceOffering;
import com.hyperlocalmart.vendor.entity.VendorServiceFor;

import java.util.Locale;

/**
 * Grocery catalog Listings is for product shops. Laundry providers sell wash/iron
 * jobs, so their vendor portal never shows Listings or Sellers.
 */
public final class CatalogListingPolicy {

    private CatalogListingPolicy() {
    }

    public static boolean isLaundryService(String name) {
        return name != null && name.toLowerCase(Locale.ROOT).contains("laundry");
    }

    public static boolean isBeautyService(String name) {
        if (name == null) {
            return false;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.contains("beauty") || lower.contains("makeup");
    }

    public static boolean isDiagnosticsService(String name) {
        if (name == null) {
            return false;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.contains("diagnostic") || lower.contains("lab");
    }

    public static boolean isFoodDeliveryService(String name) {
        if (name == null) {
            return false;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.contains("food");
    }

    public static boolean hidesListings(ServiceOffering service, boolean laundryProfile, boolean beautyProfile) {
        if (laundryProfile || beautyProfile) {
            return true;
        }
        if (service == null) {
            return false;
        }
        return service.isHidesListings() || isLaundryService(service.getName()) || isBeautyService(service.getName())
                || isDiagnosticsService(service.getName()) || isFoodDeliveryService(service.getName());
    }

    /** @deprecated use {@link #hidesListings(ServiceOffering, boolean, boolean)} */
    public static boolean hidesListings(ServiceOffering service, boolean laundryProfile) {
        return hidesListings(service, laundryProfile, false);
    }

    public static boolean hidesListingsForName(String name, Boolean requested) {
        return Boolean.TRUE.equals(requested) || isLaundryService(name) || isBeautyService(name)
                || isDiagnosticsService(name) || isFoodDeliveryService(name);
    }

    /** Makeup & Beauty → Male/Female/Unisex; Diagnostics → Private/Hospital Lab (never Unisex). */
    public static String serviceForAudienceLabel(String serviceOfferingName, VendorServiceFor value) {
        if (value == null) {
            return "";
        }
        if (isDiagnosticsService(serviceOfferingName)) {
            return switch (value) {
                case PRIVATE_LAB -> "Private Lab";
                case HOSPITAL_LAB -> "Hospital Lab";
                default -> "";
            };
        }
        if (isBeautyService(serviceOfferingName)) {
            return switch (value) {
                case MALE -> "Male";
                case FEMALE -> "Female";
                case UNISEX -> "Unisex";
                default -> "";
            };
        }
        return "";
    }
}
