package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminCancellationResponses {

    private AdminCancellationResponses() {
    }

    public enum Initiator {
        BUYER,
        VENDOR,
        PLATFORM,
        UNKNOWN
    }

    @Value
    @Builder(toBuilder = true)
    public static class AdminCancellationRowResponse {
        AdminCancellationKind kind;
        AdminCancellationVertical vertical;
        UUID orderId;
        String orderNumber;
        UUID townId;
        UUID buyerId;
        String buyerPhone;
        UUID vendorId;
        UUID shopId;
        String counterpartyName;
        String orderStatus;
        String paymentMethod;
        String paymentStatus;
        BigDecimal orderTotal;
        BigDecimal cancelledAmount;
        BigDecimal platformFee;
        BigDecimal amountCollected;
        Instant occurredAt;
        String reason;
        Initiator initiatedBy;
        String summary;
        List<String> actionHints;
        /** Relative super-admin path, e.g. /orders/{id} */
        String adminPath;
        /** Vendor cancel penalty already billed or collected for this order. */
        @Builder.Default
        boolean vendorPenaltySent = false;
    }
}