package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class SettlementCandidateResponse {
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
        VendorSubOrderStatus status;
        PaymentStatus paymentStatus;
        BigDecimal subtotal;
    }
}
