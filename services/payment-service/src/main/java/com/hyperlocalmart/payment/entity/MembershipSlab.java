package com.hyperlocalmart.payment.entity;

public enum MembershipSlab {
    QUARTERLY(3),
    HALF_YEAR(6),
    ANNUAL(12);

    private final int months;

    MembershipSlab(int months) {
        this.months = months;
    }

    public int months() {
        return months;
    }
}
