package com.hyperlocalmart.order.beauty;

public enum BeautyPaymentStatus {
    DUE,
    /** Online prepay received; balance may remain before service. */
    PARTIAL,
    COLLECTED,
    FAILED
}
