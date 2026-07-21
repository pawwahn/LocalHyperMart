package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class OrderTimelineStepResponse {
    /** Stable code for clients: ORDER_PLACED, SHOP_PREPARING, READY_FOR_AGENT, OUT_FOR_DELIVERY, DELIVERED, CANCELLED, … */
    private String code;
    private String label;
    /** DONE | CURRENT | UPCOMING | SKIPPED */
    private String state;
    private Instant at;
    private String note;
}
