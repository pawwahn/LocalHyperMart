package com.hyperlocalmart.delivery.entity;

public enum AssignmentLegType {
    PICKUP,
    LAST_MILE,
    /** Vendor's agent: shop → buyer (single leg). */
    VENDOR_DIRECT
}
