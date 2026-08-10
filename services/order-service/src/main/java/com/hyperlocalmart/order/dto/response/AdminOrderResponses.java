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
import java.util.Map;
import java.util.UUID;

public final class AdminOrderResponses {

    private AdminOrderResponses() {
    }

    @Value
    @Builder
    public static class AdminOrderSummaryResponse {
        UUID orderId;
        String orderNumber;
        UUID townId;
        UUID buyerId;
        String buyerPhone;
        OrderStatus status;
        PaymentMethod paymentMethod;
        PaymentStatus paymentStatus;
        BigDecimal totalAmount;
        Instant placedAt;
        int subOrderCount;
        int readySubOrderCount;
        /** Sub-orders already brought to hub (vendor leg complete). */
        int atHubSubOrderCount;
    }

    @Value
    @Builder
    public static class AdminSubOrderItemResponse {
        String name;
        String unitCode;
        int quantity;
        BigDecimal lineTotal;
        String status;
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
        List<AdminSubOrderItemResponse> items;
    }

    @Value
    @Builder
    public static class AdminAssignmentResponse {
        UUID assignmentId;
        String assignmentNumber;
        String orderNumber;
        String subOrderNumber;
        UUID agentId;
        String agentName;
        String agentPhone;
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
        Map<String, Object> metadata;
    }

    @Value
    @Builder
    public static class AdminOrderDetailResponse {
        UUID orderId;
        String orderNumber;
        UUID townId;
        UUID buyerId;
        String buyerPhone;
        String recipientName;
        String deliveryAddress;
        OrderStatus status;
        PaymentMethod paymentMethod;
        PaymentStatus paymentStatus;
        BigDecimal itemsSubtotal;
        BigDecimal deliveryFee;
        BigDecimal storeCreditApplied;
        BigDecimal promoDiscount;
        String promoCode;
        BigDecimal totalAmount;
        Instant placedAt;
        Instant deliveredAt;
        Instant cancelledAt;
        String cancelReason;
        List<AdminSubOrderResponse> subOrders;
        List<AdminAssignmentResponse> assignments;
    }
}
