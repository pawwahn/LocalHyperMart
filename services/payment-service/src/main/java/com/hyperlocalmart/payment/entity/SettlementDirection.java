package com.hyperlocalmart.payment.entity;

/** PAYOUT = platform pays the payee. COLLECTION = payee pays the platform (franchise or vendor fees). */
public enum SettlementDirection {
    PAYOUT,
    COLLECTION
}
