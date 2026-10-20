package com.hyperlocalmart.order.entity;

public enum VendorSubOrderStatus {
    PLACED,
    READY_FOR_PICKUP,
    /** Shop delivers with vendor's own agent; town hub does not operate this bag. */
    DELIVERY_BY_VENDOR_AGENT,
    /** Shop refused the bag. */
    VENDOR_REJECTED,
    /** Buyer cancelled this shop's bag before pickup. */
    BUYER_CANCELLED,
    DELIVERED;

    /** Bag is off the delivery path. Shop reject and buyer cancel both close it. */
    public boolean isClosed() {
        return this == VENDOR_REJECTED || this == BUYER_CANCELLED;
    }
}
