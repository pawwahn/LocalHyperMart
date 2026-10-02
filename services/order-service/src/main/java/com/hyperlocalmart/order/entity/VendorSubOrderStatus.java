package com.hyperlocalmart.order.entity;

public enum VendorSubOrderStatus {
    PLACED,
    READY_FOR_PICKUP,
    /** Shop delivers with vendor's own agent; town hub does not operate this bag. */
    DELIVERY_BY_VENDOR_AGENT,
    VENDOR_REJECTED,
    DELIVERED
}
