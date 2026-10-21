package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.PaymentMethod;
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
        Instant deliveredAt;
        VendorSubOrderStatus status;
        PaymentStatus paymentStatus;
        PaymentMethod paymentMethod;
        /** Shop's own delivery agent — COD is remitted to vendor, not hub close-day. */
        boolean vendorAgentDelivery;
        BigDecimal subtotal;
        /** Pieces on this order. Per-piece platform fees use this. Null counts as 0. */
        Integer pieceCount;
        /**
         * Town platform fee the buyer paid on this order. Billed back when the shop holds the cash.
         * This is separate from the vendor billing quote.
         */
        BigDecimal platformFee;
        /** Town COD charge the buyer paid. Billed back when the shop holds the cash. Null on grocery bags. */
        BigDecimal codFee;
    }
}
