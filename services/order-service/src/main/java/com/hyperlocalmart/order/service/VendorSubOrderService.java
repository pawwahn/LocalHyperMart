package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.dto.request.RejectSubOrderRequest;
import com.hyperlocalmart.order.dto.response.OrderItemDetailResponse;
import com.hyperlocalmart.order.dto.response.VendorSubOrderResponse;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderStatusHistoryRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VendorSubOrderService {

    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final OrderRepository orderRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final PaymentClient paymentClient;
    private final NotificationClient notificationClient;

    @Transactional(readOnly = true)
    public PageResponse<VendorSubOrderResponse> listSubOrders(UUID vendorId, VendorSubOrderStatus status, int page, int size) {
        PageRequest pageable = PageRequest.of(page, size);
        Page<VendorSubOrder> results = status == null
                ? vendorSubOrderRepository.findByVendorIdOrderByCreatedAtDesc(vendorId, pageable)
                : vendorSubOrderRepository.findByVendorIdAndStatusOrderByCreatedAtDesc(vendorId, status, pageable);
        List<VendorSubOrderResponse> items = results.getContent().stream().map(this::toResponse).toList();
        return PageResponse.<VendorSubOrderResponse>builder()
                .items(items)
                .page(results.getNumber())
                .size(results.getSize())
                .totalElements(results.getTotalElements())
                .totalPages(results.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public VendorSubOrderResponse getSubOrder(UUID vendorId, UUID subOrderId) {
        VendorSubOrder subOrder = vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Sub-order not found"));
        return toResponse(subOrder);
    }

    @Transactional
    public VendorSubOrderResponse markReady(UUID vendorId, UUID subOrderId, UUID actorUserId) {
        VendorSubOrder subOrder = loadForVendorAction(vendorId, subOrderId);
        if (subOrder.getStatus() != VendorSubOrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Sub-order cannot be marked ready");
        }
        subOrder.setStatus(VendorSubOrderStatus.READY_FOR_PICKUP);
        subOrder.setReadyForPickupAt(Instant.now());
        vendorSubOrderRepository.save(subOrder);

        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(subOrder.getOrder().getId())
                .vendorSubOrderId(subOrder.getId())
                .fromStatus(VendorSubOrderStatus.PLACED.name())
                .toStatus(VendorSubOrderStatus.READY_FOR_PICKUP.name())
                .changedBy(actorUserId)
                .changedByRole("VENDOR")
                .build());
        Order order = subOrder.getOrder();
        String shopName = subOrder.getItems().isEmpty() ? "shop" : subOrder.getItems().getFirst().getShopNameSnapshot();
        notificationClient.notifySubOrderReady(
                order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                order.getOrderNumber(), shopName);
        return toResponse(subOrder);
    }

    @Transactional
    public VendorSubOrderResponse reject(UUID vendorId, UUID subOrderId, UUID actorUserId, RejectSubOrderRequest request) {
        VendorSubOrder subOrder = loadForVendorAction(vendorId, subOrderId);
        if (subOrder.getStatus() != VendorSubOrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Sub-order cannot be rejected");
        }

        Order order = subOrder.getOrder();
        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order already cancelled");
        }

        OrderStatus priorStatus = order.getStatus();
        subOrder.setStatus(VendorSubOrderStatus.VENDOR_REJECTED);
        subOrder.setRejectReason(request.getReason());

        for (VendorSubOrder sibling : order.getVendorSubOrders()) {
            if (sibling.getStatus() == VendorSubOrderStatus.PLACED) {
                sibling.setStatus(VendorSubOrderStatus.VENDOR_REJECTED);
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelReason(request.getReason());
        order.setCancelledAt(Instant.now());
        if (order.getPaymentStatus() == PaymentStatus.PAID && order.getPaymentMethod() == PaymentMethod.ONLINE) {
            order.setPaymentStatus(PaymentStatus.REFUNDED);
            paymentClient.initiateRefund(order.getId(), order.getBuyerId(), order.getTotalAmount(), request.getReason());
        }

        orderRepository.save(order);

        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .vendorSubOrderId(subOrder.getId())
                .fromStatus(VendorSubOrderStatus.PLACED.name())
                .toStatus(VendorSubOrderStatus.VENDOR_REJECTED.name())
                .changedBy(actorUserId)
                .changedByRole("VENDOR")
                .note(request.getReason())
                .build());
        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .fromStatus(priorStatus.name())
                .toStatus(OrderStatus.CANCELLED.name())
                .changedBy(actorUserId)
                .changedByRole("VENDOR")
                .note("Vendor rejected: " + request.getReason())
                .build());

        notificationClient.notifyOrderCancelled(
                order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                order.getOrderNumber(), request.getReason());
        if (order.getPaymentMethod() == PaymentMethod.ONLINE && order.getPaymentStatus() == PaymentStatus.REFUNDED) {
            notificationClient.notifyRefundInitiated(
                    order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                    order.getOrderNumber(), order.getTotalAmount(), 5);
        }

        return toResponse(subOrder);
    }

    private VendorSubOrder loadForVendorAction(UUID vendorId, UUID subOrderId) {
        return vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Sub-order not found"));
    }

    private VendorSubOrderResponse toResponse(VendorSubOrder subOrder) {
        List<OrderItemDetailResponse> items = subOrder.getItems().stream()
                .map(item -> OrderItemDetailResponse.builder()
                        .name(item.getItemNameSnapshot())
                        .shopName(item.getShopNameSnapshot())
                        .quantity(item.getQuantity())
                        .lineTotal(item.getLineTotal())
                        .build())
                .toList();
        return VendorSubOrderResponse.builder()
                .subOrderId(subOrder.getId())
                .orderId(subOrder.getOrder().getId())
                .orderNumber(subOrder.getOrder().getOrderNumber())
                .vendorId(subOrder.getVendorId())
                .shopId(subOrder.getShopId())
                .status(subOrder.getStatus())
                .subtotal(subOrder.getSubtotal())
                .readyForPickupAt(subOrder.getReadyForPickupAt())
                .items(items)
                .build();
    }
}
