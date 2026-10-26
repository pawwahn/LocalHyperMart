package com.hyperlocalmart.delivery.service;

import java.util.UUID;

public final class AssignmentNumberFormatter {

    private AssignmentNumberFormatter() {
    }

    public static String pickup(String subOrderNumber) {
        return subOrderNumber + "-TO-HUB";
    }

    public static String lastMile(String orderNumber) {
        return orderNumber + "-TO-BUYER";
    }

    public static String vendorDirect(String subOrderNumber) {
        return subOrderNumber + "-VENDOR-DIRECT";
    }

    public static String laundry(String orderNumber) {
        return laundry(orderNumber, null);
    }

    /** Pickup and drop each need their own number — one order has both trips. */
    public static String laundry(String orderNumber, String tripKind) {
        String base = orderNumber + "-LAUNDRY";
        if (tripKind != null && tripKind.toUpperCase().contains("DROP")) {
            return base + "-DROP";
        }
        if (tripKind != null && tripKind.toUpperCase().contains("PICKUP")) {
            return base + "-PICKUP";
        }
        return base;
    }

    /** Frees a unique index slot when an assignment row is cancelled or superseded. */
    public static String releasedUnique(String assignmentNumber, UUID assignmentId) {
        if (assignmentNumber == null || assignmentNumber.isBlank()) {
            return null;
        }
        String suffix = assignmentId.toString().substring(0, 8);
        String tag = "-X-" + suffix;
        int maxBase = 60 - tag.length();
        if (maxBase < 1) {
            return tag.substring(0, Math.min(60, tag.length()));
        }
        String base = assignmentNumber.length() <= maxBase ? assignmentNumber : assignmentNumber.substring(0, maxBase);
        return base + tag;
    }
}
