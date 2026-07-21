package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class SettlementCandidateView {
    UUID vendorId;
    UUID townId;
    String from;
    String to;
    List<Item> items;

    @Value
    @Builder
    public static class Item {
        UUID subOrderId;
        UUID orderId;
        String orderNumber;
        String subOrderNumber;
        Instant placedAt;
        String status;
        String paymentStatus;
        BigDecimal subtotal;
        boolean alreadySettled;
    }
}
