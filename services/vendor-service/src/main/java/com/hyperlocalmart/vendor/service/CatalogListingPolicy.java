package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.vendor.entity.ServiceOffering;

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

    public static boolean hidesListings(ServiceOffering service, boolean laundryProfile) {
        if (laundryProfile) {
            return true;
        }
        if (service == null) {
            return false;
        }
        return service.isHidesListings() || isLaundryService(service.getName());
    }

    public static boolean hidesListingsForName(String name, Boolean requested) {
        return Boolean.TRUE.equals(requested) || isLaundryService(name);
    }
}
