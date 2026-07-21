package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.dto.request.CancelOrderItemRequest;
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

import java.math.BigDecimal;
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
        boolean hasActive = subOrder.getItems().stream()
                .anyMatch(item -> item.getStatus() == null || item.getStatus() == OrderItemStatus.ACTIVE);
        if (!hasActive) {
            throw new BusinessException(ErrorCode.CONFLICT, "No active items left to mark ready");
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

    /**
     * Cancel a single line item while the sub-order is still PLACED.
     * Credits the buyer wallet for the line total; does not cancel sibling vendors' items.
     */
    @Transactional
    public VendorSubOrderResponse cancelItem(UUID vendorId, UUID subOrderId, UUID itemId,
                                             UUID actorUserId, CancelOrderItemRequest request) {
        VendorSubOrder subOrder = loadForVendorAction(vendorId, subOrderId);
        if (subOrder.getStatus() != VendorSubOrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Items can only be cancelled while sub-order is PLACED");
        }
        Order order = subOrder.getOrder();
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order cannot be modified");
        }

        OrderItem item = subOrder.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order item not found"));
        if (item.getStatus() == OrderItemStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Item already cancelled");
        }

        BigDecimal creditAmount = item.getLineTotal();
        item.setStatus(OrderItemStatus.CANCELLED);
        item.setCancelReason(request.getReason());
        item.setCancelledAt(Instant.now());
        item.setCancelledBy(actorUserId);
        item.setStoreCreditAmount(creditAmount);

        BigDecimal newSubtotal = subOrder.getItems().stream()
                .filter(i -> i.getStatus() == null || i.getStatus() == OrderItemStatus.ACTIVE)
                .map(OrderItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        subOrder.setSubtotal(newSubtotal);

        BigDecimal newItemsSubtotal = order.getVendorSubOrders().stream()
                .flatMap(so -> so.getItems().stream())
                .filter(i -> i.getStatus() == null || i.getStatus() == OrderItemStatus.ACTIVE)
                .map(OrderItem::getLineTotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        order.setItemsSubtotal(newItemsSubtotal);
        BigDecimal promo = order.getPromoDiscount() == null ? BigDecimal.ZERO : order.getPromoDiscount();
        BigDecimal payableItems = newItemsSubtotal.subtract(promo).max(BigDecimal.ZERO);
        BigDecimal newTotal = payableItems.add(order.getDeliveryFee() == null ? BigDecimal.ZERO : order.getDeliveryFee());
        BigDecimal creditApplied = order.getStoreCreditApplied() == null ? BigDecimal.ZERO : order.getStoreCreditApplied();
        order.setTotalAmount(newTotal.subtract(creditApplied).max(BigDecimal.ZERO));

        boolean subOrderEmpty = subOrder.getItems().stream()
                .noneMatch(i -> i.getStatus() == null || i.getStatus() == OrderItemStatus.ACTIVE);
        if (subOrderEmpty) {
            subOrder.setStatus(VendorSubOrderStatus.VENDOR_REJECTED);
            subOrder.setRejectReason(request.getReason());
            orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                    .orderId(order.getId())
                    .vendorSubOrderId(subOrder.getId())
                    .fromStatus(VendorSubOrderStatus.PLACED.name())
                    .toStatus(VendorSubOrderStatus.VENDOR_REJECTED.name())
                    .changedBy(actorUserId)
                    .changedByRole("VENDOR")
                    .note("All items cancelled: " + request.getReason())
                    .build());
        }

        boolean orderEmpty = order.getVendorSubOrders().stream()
                .flatMap(so -> so.getItems().stream())
                .noneMatch(i -> i.getStatus() == null || i.getStatus() == OrderItemStatus.ACTIVE);
        if (orderEmpty) {
            OrderStatus prior = order.getStatus();
            order.setStatus(OrderStatus.CANCELLED);
            order.setCancelReason(request.getReason());
            order.setCancelledAt(Instant.now());
            orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                    .orderId(order.getId())
                    .fromStatus(prior.name())
                    .toStatus(OrderStatus.CANCELLED.name())
                    .changedBy(actorUserId)
                    .changedByRole("VENDOR")
                    .note("All items cancelled: " + request.getReason())
                    .build());
        }

        orderRepository.save(order);
        vendorSubOrderRepository.save(subOrder);

        BigDecimal balance = paymentClient.creditWallet(
                order.getBuyerId(),
                creditAmount,
                "ORDER_ITEM_CANCEL",
                item.getId(),
                order.getId(),
                item.getId(),
                "Item cancelled: " + item.getItemNameSnapshot());

        notificationClient.notifyItemCancelledStoreCredit(
                order.getTownId(),
                order.getId(),
                order.getBuyerId(),
                order.getBuyerPhoneSnapshot(),
                order.getOrderNumber(),
                item.getItemNameSnapshot(),
                creditAmount,
                balance);

        return toResponse(subOrder);
    }

    private VendorSubOrder loadForVendorAction(UUID vendorId, UUID subOrderId) {
        return vendorSubOrderRepository.findDetailedByIdAndVendorId(subOrderId, vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Sub-order not found"));
    }

    private VendorSubOrderResponse toResponse(VendorSubOrder subOrder) {
        List<OrderItemDetailResponse> items = subOrder.getItems().stream()
                .map(this::toItemDetail)
                .toList();
        return VendorSubOrderResponse.builder()
                .subOrderId(subOrder.getId())
                .subOrderNumber(subOrder.getSubOrderNumber())
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

    private OrderItemDetailResponse toItemDetail(OrderItem item) {
        return OrderItemDetailResponse.builder()
                .orderItemId(item.getId())
                .name(item.getItemNameSnapshot())
                .shopName(item.getShopNameSnapshot())
                .unitCode(item.getUnitCodeSnapshot())
                .quantity(item.getQuantity())
                .lineTotal(item.getLineTotal())
                .status(item.getStatus() == null ? OrderItemStatus.ACTIVE : item.getStatus())
                .cancelReason(item.getCancelReason())
                .cancelledAt(item.getCancelledAt())
                .storeCreditAmount(item.getStoreCreditAmount())
                .build();
    }
}
