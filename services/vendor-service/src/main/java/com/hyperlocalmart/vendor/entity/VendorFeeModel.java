package com.hyperlocalmart.vendor.entity;

/**
 * Per-vendor platform fee model (independent of town).
 * Applied when computing settlement commission / subscription deductions.
 */
public enum VendorFeeModel {
    /** No platform fee / commission on payouts. */
    NONE,
    /** Fixed ₹ deducted per settled sub-order. */
    PER_ORDER_FLAT,
    /** Flat % of settlement gross. */
    COMMISSION_PCT,
    /** % chosen from GMV slabs (based on this payout's gross). */
    SLAB_COMMISSION,
    /** Fixed monthly subscription; deducted once per calendar month on payout. */
    MONTHLY_SUBSCRIPTION,
    /** Monthly subscription + % commission on gross. */
    HYBRID
}
