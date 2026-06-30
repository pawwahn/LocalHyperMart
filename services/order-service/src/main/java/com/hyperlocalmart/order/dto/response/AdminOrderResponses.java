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
    }

    @Value
    @Builder
    public static class AdminSubOrderResponse {
        UUID subOrderId;
        UUID vendorId;
        UUID shopId;
        VendorSubOrderStatus status;
        BigDecimal subtotal;
        Instant readyForPickupAt;
        int itemCount;
    }

    @Value
    @Builder
    public static class AdminAssignmentResponse {
        UUID assignmentId;
        UUID agentId;
        String legType;
        String status;
        Instant assignedAt;
        Instant completedAt;
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
