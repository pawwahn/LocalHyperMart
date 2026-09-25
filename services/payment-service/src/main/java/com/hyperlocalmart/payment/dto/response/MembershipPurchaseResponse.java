package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class MembershipPurchaseResponse {
    UUID purchaseId;
    UUID buyerId;
    String buyerPhone;
    String slab;
    int months;
    int creditsGranted;
    BigDecimal price;
    String channel;
    String status;
    Instant paidAt;
    Instant expiresAtAfter;
    Instant createdAt;
    String note;
    GatewayCheckoutResponse checkout;
}
