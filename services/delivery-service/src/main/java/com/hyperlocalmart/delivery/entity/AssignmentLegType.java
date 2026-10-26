package com.hyperlocalmart.delivery.entity;

public enum AssignmentLegType {
    PICKUP,
    LAST_MILE,
    /** Vendor's agent: shop → buyer (single leg). */
    VENDOR_DIRECT,
    /** Vendor laundry: pickup from customer or drop to customer (snapshot on row). */
    LAUNDRY_TRIP
}
