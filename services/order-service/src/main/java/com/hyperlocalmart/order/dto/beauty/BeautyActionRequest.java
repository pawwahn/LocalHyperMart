package com.hyperlocalmart.order.dto.beauty;

import lombok.Data;

@Data
public class BeautyActionRequest {
    private String action;
    private String note;
    /** Required when completing a booking that still has balance due at the visit (partial prepay / cash). */
    private Boolean visitCashCollected;
}
