package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class AdminOrderResponses {

    private AdminOrderResponses() {
    }

    @Value
    @Builder
    public static class AdminOrderSummaryResponse {
        UUID orderId;
        String orderNumber;
        UUID buyerId;
        OrderStatus status;
        PaymentStatus paymentStatus;
        BigDecimal totalAmount;
        Instant placedAt;
        int subOrderCount;
        int readySubOrderCount;
    }

    @Value
    @Builder
    public static class AdminSubOrderResponse {
        UUID subOrderId;
        String subOrderNumber;
        UUID vendorId;
        UUID shopId;
        /** Snapshot shop/vendor name for hub staff (call the shop). */
        String shopName;
        VendorSubOrderStatus status;
        BigDecimal subtotal;
        Instant readyForPickupAt;
        int itemCount;
    }

    @Value
    @Builder
    public static class AdminAssignmentResponse {
        UUID assignmentId;
        String assignmentNumber;
        String orderNumber;
        String subOrderNumber;
        UUID agentId;
        String legType;
        String status;
        Instant assignedAt;
        Instant startedAt;
        Instant completedAt;
        List<AdminAssignmentEventResponse> events;
    }

    @Value
    @Builder
    public static class AdminAssignmentEventResponse {
        UUID eventId;
        String eventType;
        Instant createdAt;
        UUID createdBy;
    }

    @Value
    @Builder
    public static class AdminOrderDetailResponse {
        UUID orderId;
        String orderNumber;
        UUID townId;
        UUID buyerId;
        OrderStatus status;
        PaymentMethod paymentMethod;
        PaymentStatus paymentStatus;
        BigDecimal totalAmount;
        Instant placedAt;
        Instant deliveredAt;
        Instant cancelledAt;
        List<AdminSubOrderResponse> subOrders;
        List<AdminAssignmentResponse> assignments;
    }
}
