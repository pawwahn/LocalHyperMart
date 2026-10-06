package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class CashHolderContextResponse {
    UUID orderId;
    String paymentMethod;
    boolean vendorAgentDelivery;
    UUID townId;
    /** Set when {@code vendorAgentDelivery} — used to resolve shop agent name. */
    UUID vendorId;
}
