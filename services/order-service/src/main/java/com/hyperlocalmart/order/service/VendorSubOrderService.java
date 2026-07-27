package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.dto.request.CancelOrderItemRequest;
import com.hyperlocalmart.order.dto.request.RejectSubOrderRequest;
import com.hyperlocalmart.order.dto.response.OrderItemDetailResponse;
import com.hyperlocalmart.order.dto.response.VendorSubOrderResponse;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderItemRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderStatusHistoryRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class VendorSubOrderService {

    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final PaymentClient paymentClient;
    private final NotificationClient notificationClient;
    private final DeliveryClient deliveryClient;
    private final OrderMoneyUnwindService orderMoneyUnwindService;

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

    /**
     * Reject this shop's bag only. Sibling shops keep packing / stay ready.
     * Buyer gets wallet credit for this shop's active lines (or a full money unwind
     * if this was the last remaining shop).
     */
    @Transactional
    public VendorSubOrderResponse reject(UUID vendorId, UUID subOrderId, UUID actorUserId, RejectSubOrderRequest request) {
        VendorSubOrder subOrder = loadForVendorAction(vendorId, subOrderId);
        if (subOrder.getStatus() != VendorSubOrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Sub-order cannot be rejected");
        }

        Order order = subOrder.getOrder();
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order cannot be modified");
        }

        List<OrderItem> toCancel = subOrder.getItems().stream()
                .filter(i -> i.getStatus() == null || i.getStatus() == OrderItemStatus.ACTIVE)
                .toList();
        if (toCancel.isEmpty()) {
            throw new BusinessException(ErrorCode.CONFLICT, "No active items left to reject");
        }

        BigDecimal shopCredit = BigDecimal.ZERO;
        boolean issueStoreCredit = shouldIssueStoreCredit(order);
        for (OrderItem item : toCancel) {
            BigDecimal creditAmount = item.getLineTotal();
            item.setStatus(OrderItemStatus.CANCELLED);
            item.setCancelReason(request.getReason());
            item.setCancelledAt(Instant.now());
            item.setCancelledBy(actorUserId);
            // COD: cash due shrinks with totals — do not also wallet-credit (double benefit).
            item.setStoreCreditAmount(issueStoreCredit ? creditAmount : null);
            shopCredit = shopCredit.add(creditAmount);
        }

        subOrder.setStatus(VendorSubOrderStatus.VENDOR_REJECTED);
        subOrder.setRejectReason(request.getReason());

        vendorSubOrderRepository.saveAndFlush(subOrder);
        orderRepository.saveAndFlush(order);
        recalculateTotals(subOrder, order);

        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .vendorSubOrderId(subOrder.getId())
                .fromStatus(VendorSubOrderStatus.PLACED.name())
                .toStatus(VendorSubOrderStatus.VENDOR_REJECTED.name())
                .changedBy(actorUserId)
                .changedByRole("VENDOR")
                .note("Shop rejected: " + request.getReason())
                .build());

        String shopLabel = toCancel.get(0).getShopNameSnapshot() != null
                ? toCancel.get(0).getShopNameSnapshot()
                : "a shop";
        notifyHubVendorRejected(order, shopLabel, shopCredit, request.getReason());

        BigDecimal remainingActive = orderItemRepository.sumActiveLineTotalsForOrder(order.getId());
        boolean orderEmpty = remainingActive == null || remainingActive.compareTo(BigDecimal.ZERO) == 0;
        if (orderEmpty) {
            // These lines were never wallet-credited — clear markers so unwind does not
            // debit the buyer for them. Only earlier shops' item credits get reversed.
            for (OrderItem item : toCancel) {
                item.setStoreCreditAmount(null);
            }

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
                    .note("Vendor rejected last shop: " + request.getReason())
                    .build());

            OrderMoneyUnwindService.UnwindResult unwind =
                    orderMoneyUnwindService.unwindCancelledOrder(order, request.getReason());
            orderRepository.save(order);
            vendorSubOrderRepository.save(subOrder);

            notificationClient.notifyOrderCancelled(
                    order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                    order.getOrderNumber(), request.getReason());
            if (unwind.gatewayRefunded()) {
                notificationClient.notifyRefundInitiated(
                        order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                        order.getOrderNumber(), unwind.gatewayRefundAmount(), 5);
            }
            return toResponse(subOrder);
        }

        orderRepository.save(order);
        vendorSubOrderRepository.save(subOrder);

        if (issueStoreCredit) {
            BigDecimal balance;
            try {
                balance = paymentClient.creditWallet(
                        order.getBuyerId(),
                        shopCredit,
                        "ORDER_ITEM_CANCEL",
                        subOrderId,
                        order.getId(),
                        toCancel.get(0).getId(),
                        "Shop rejected: " + request.getReason());
            } catch (RuntimeException ex) {
                log.error("Wallet credit failed while rejecting shop {}", subOrderId, ex);
                throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                        "Could not credit buyer wallet. Try again in a moment.");
            }

            try {
                notificationClient.notifyItemCancelledStoreCredit(
                        order.getTownId(),
                        order.getId(),
                        order.getBuyerId(),
                        order.getBuyerPhoneSnapshot(),
                        order.getOrderNumber(),
                        shopLabel + " items",
                        shopCredit,
                        balance);
            } catch (RuntimeException ex) {
                log.warn("Reject notification failed for sub-order {}: {}", subOrderId, ex.toString());
            }
        } else {
            try {
                notificationClient.notifyItemRemovedCodReduced(
                        order.getTownId(),
                        order.getId(),
                        order.getBuyerId(),
                        order.getBuyerPhoneSnapshot(),
                        order.getOrderNumber(),
                        shopLabel + " items",
                        order.getTotalAmount() == null ? BigDecimal.ZERO : order.getTotalAmount());
            } catch (RuntimeException ex) {
                log.warn("COD reject notification failed for sub-order {}: {}", subOrderId, ex.toString());
            }
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
        boolean issueStoreCredit = shouldIssueStoreCredit(order);
        item.setStatus(OrderItemStatus.CANCELLED);
        item.setCancelReason(request.getReason());
        item.setCancelledAt(Instant.now());
        item.setCancelledBy(actorUserId);
        item.setStoreCreditAmount(issueStoreCredit ? creditAmount : null);

        // Persist cancelled state before query-based totals (avoids lazy sibling collection issues).
        vendorSubOrderRepository.saveAndFlush(subOrder);
        orderRepository.saveAndFlush(order);
        recalculateTotals(subOrder, order);

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
            String shopLabel = item.getShopNameSnapshot() != null ? item.getShopNameSnapshot() : "a shop";
            notifyHubVendorRejected(order, shopLabel, creditAmount, request.getReason());
        }

        BigDecimal remainingActive = orderItemRepository.sumActiveLineTotalsForOrder(order.getId());
        boolean orderEmpty = remainingActive == null || remainingActive.compareTo(BigDecimal.ZERO) == 0;
        if (orderEmpty) {
            item.setStoreCreditAmount(null);
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

            OrderMoneyUnwindService.UnwindResult unwind =
                    orderMoneyUnwindService.unwindCancelledOrder(order, request.getReason(), itemId);
            orderRepository.save(order);
            vendorSubOrderRepository.save(subOrder);

            notificationClient.notifyOrderCancelled(
                    order.getTownId(),
                    order.getId(),
                    order.getBuyerId(),
                    order.getBuyerPhoneSnapshot(),
                    order.getOrderNumber(),
                    request.getReason());
            if (unwind.gatewayRefunded()) {
                notificationClient.notifyRefundInitiated(
                        order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                        order.getOrderNumber(), unwind.gatewayRefundAmount(), 5);
            }
            return toResponse(subOrder);
        }

        orderRepository.save(order);
        vendorSubOrderRepository.save(subOrder);

        if (issueStoreCredit) {
            BigDecimal balance;
            try {
                balance = paymentClient.creditWallet(
                        order.getBuyerId(),
                        creditAmount,
                        "ORDER_ITEM_CANCEL",
                        itemId,
                        order.getId(),
                        item.getId(),
                        "Item cancelled: " + item.getItemNameSnapshot());
            } catch (RuntimeException ex) {
                log.error("Wallet credit failed while cancelling item {}", itemId, ex);
                throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                        "Could not credit buyer wallet. Try again in a moment.");
            }

            try {
                notificationClient.notifyItemCancelledStoreCredit(
                        order.getTownId(),
                        order.getId(),
                        order.getBuyerId(),
                        order.getBuyerPhoneSnapshot(),
                        order.getOrderNumber(),
                        item.getItemNameSnapshot(),
                        creditAmount,
                        balance);
            } catch (RuntimeException ex) {
                log.warn("Cancel notification failed for item {}: {}", itemId, ex.toString());
            }
        } else {
            try {
                notificationClient.notifyItemRemovedCodReduced(
                        order.getTownId(),
                        order.getId(),
                        order.getBuyerId(),
                        order.getBuyerPhoneSnapshot(),
                        order.getOrderNumber(),
                        item.getItemNameSnapshot(),
                        order.getTotalAmount() == null ? BigDecimal.ZERO : order.getTotalAmount());
            } catch (RuntimeException ex) {
                log.warn("COD cancel notification failed for item {}: {}", itemId, ex.toString());
            }
        }

        return toResponse(subOrder);
    }

    /**
     * Restore a cancelled line before pickup, only if the buyer still has enough store credit
     * to reverse the earlier credit. Debits wallet then reactivates the item.
     */
    @Transactional
    public VendorSubOrderResponse restoreItem(UUID vendorId, UUID subOrderId, UUID itemId, UUID actorUserId) {
        VendorSubOrder subOrder = loadForVendorAction(vendorId, subOrderId);
        VendorSubOrderStatus status = subOrder.getStatus();
        boolean restorableStatus = status == VendorSubOrderStatus.PLACED
                || status == VendorSubOrderStatus.READY_FOR_PICKUP
                || status == VendorSubOrderStatus.VENDOR_REJECTED;
        if (!restorableStatus) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Item can only be restored before the delivery agent picks up from your shop");
        }

        Order order = subOrder.getOrder();
        if (order.getStatus() == OrderStatus.CANCELLED || order.getStatus() == OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order cannot be modified");
        }

        OrderItem item = subOrder.getItems().stream()
                .filter(i -> i.getId().equals(itemId))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order item not found"));
        if (item.getStatus() != OrderItemStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Item is not cancelled");
        }

        BigDecimal creditAmount = item.getStoreCreditAmount() != null
                ? item.getStoreCreditAmount()
                : item.getLineTotal();
        if (creditAmount == null || creditAmount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessException(ErrorCode.CONFLICT, "No store credit on this item to reverse");
        }

        BigDecimal balance;
        try {
            balance = paymentClient.getWalletBalance(order.getBuyerId());
        } catch (RuntimeException ex) {
            log.error("Wallet balance check failed for restore item {}", itemId, ex);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                    "Could not check buyer wallet. Try again in a moment.");
        }
        if (balance.compareTo(creditAmount) < 0) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Can't restore — buyer has already used this store credit.");
        }

        String priorCancelReason = item.getCancelReason();
        Instant priorCancelledAt = item.getCancelledAt();
        UUID priorCancelledBy = item.getCancelledBy();
        BigDecimal priorCredit = item.getStoreCreditAmount();
        VendorSubOrderStatus priorSubStatus = subOrder.getStatus();

        item.setStatus(OrderItemStatus.ACTIVE);
        item.setCancelReason(null);
        item.setCancelledAt(null);
        item.setCancelledBy(null);
        item.setStoreCreditAmount(null);

        // Persist item state before money move so query-based totals see ACTIVE lines.
        vendorSubOrderRepository.saveAndFlush(subOrder);
        orderRepository.saveAndFlush(order);
        recalculateTotals(subOrder, order);

        if (subOrder.getStatus() == VendorSubOrderStatus.VENDOR_REJECTED) {
            VendorSubOrderStatus restoredStatus = subOrder.getReadyForPickupAt() != null
                    ? VendorSubOrderStatus.READY_FOR_PICKUP
                    : VendorSubOrderStatus.PLACED;
            subOrder.setStatus(restoredStatus);
            subOrder.setRejectReason(null);
            orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                    .orderId(order.getId())
                    .vendorSubOrderId(subOrder.getId())
                    .fromStatus(VendorSubOrderStatus.VENDOR_REJECTED.name())
                    .toStatus(restoredStatus.name())
                    .changedBy(actorUserId)
                    .changedByRole("VENDOR")
                    .note("Item restored: " + item.getItemNameSnapshot())
                    .build());
        }

        orderRepository.save(order);
        vendorSubOrderRepository.save(subOrder);

        try {
            paymentClient.debitWallet(
                    order.getBuyerId(),
                    creditAmount,
                    "ORDER_ITEM_RESTORE",
                    UUID.randomUUID(),
                    order.getId(),
                    "Item restored: " + item.getItemNameSnapshot());
        } catch (RuntimeException ex) {
            log.warn("Wallet debit failed while restoring item {}: {}", itemId, ex.toString());
            item.setStatus(OrderItemStatus.CANCELLED);
            item.setCancelReason(priorCancelReason);
            item.setCancelledAt(priorCancelledAt);
            item.setCancelledBy(priorCancelledBy);
            item.setStoreCreditAmount(priorCredit);
            subOrder.setStatus(priorSubStatus);
            vendorSubOrderRepository.saveAndFlush(subOrder);
            orderRepository.saveAndFlush(order);
            recalculateTotals(subOrder, order);
            orderRepository.save(order);
            vendorSubOrderRepository.save(subOrder);
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Can't restore — buyer has already used this store credit.");
        }

        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .vendorSubOrderId(subOrder.getId())
                .fromStatus(status.name())
                .toStatus(subOrder.getStatus().name())
                .changedBy(actorUserId)
                .changedByRole("VENDOR")
                .note("Restored item: " + item.getItemNameSnapshot())
                .build());

        try {
            notificationClient.notifyItemRestored(
                    order.getTownId(),
                    order.getId(),
                    order.getBuyerId(),
                    order.getBuyerPhoneSnapshot(),
                    order.getOrderNumber(),
                    item.getItemNameSnapshot(),
                    creditAmount);
        } catch (RuntimeException ex) {
            log.warn("Restore notification failed for item {}: {}", itemId, ex.toString());
        }

        return toResponse(subOrder);
    }

    private void recalculateTotals(VendorSubOrder subOrder, Order order) {
        // In-memory for this bag — JPQL can miss cancel/reject status before flush.
        BigDecimal newSubtotal = sumActiveFromItems(subOrder.getItems());
        subOrder.setSubtotal(newSubtotal);
        vendorSubOrderRepository.saveAndFlush(subOrder);

        BigDecimal newItemsSubtotal = orderItemRepository.sumActiveLineTotalsForOrder(order.getId());
        if (newItemsSubtotal == null) {
            newItemsSubtotal = BigDecimal.ZERO;
        }
        order.setItemsSubtotal(newItemsSubtotal);
        BigDecimal promo = order.getPromoDiscount() == null ? BigDecimal.ZERO : order.getPromoDiscount();
        BigDecimal payableItems = newItemsSubtotal.subtract(promo).max(BigDecimal.ZERO);
        boolean empty = newItemsSubtotal.compareTo(BigDecimal.ZERO) == 0;
        BigDecimal delivery = empty
                ? BigDecimal.ZERO
                : (order.getDeliveryFee() == null ? BigDecimal.ZERO : order.getDeliveryFee());
        if (empty) {
            order.setDeliveryFee(BigDecimal.ZERO);
        }
        BigDecimal newTotal = payableItems.add(delivery);
        BigDecimal creditApplied = order.getStoreCreditApplied() == null ? BigDecimal.ZERO : order.getStoreCreditApplied();
        order.setTotalAmount(newTotal.subtract(creditApplied).max(BigDecimal.ZERO));
    }

    private static BigDecimal sumActiveFromItems(List<OrderItem> items) {
        if (items == null || items.isEmpty()) {
            return BigDecimal.ZERO;
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (OrderItem item : items) {
            if (item.getStatus() == null || item.getStatus() == OrderItemStatus.ACTIVE) {
                sum = sum.add(item.getLineTotal() == null ? BigDecimal.ZERO : item.getLineTotal());
            }
        }
        return sum;
    }

    private void notifyHubVendorRejected(Order order, String shopName, BigDecimal amount, String reason) {
        try {
            List<DeliveryClient.HubContact> contacts = deliveryClient.listHubContactsForTown(order.getTownId());
            for (DeliveryClient.HubContact contact : contacts) {
                notificationClient.notifyVendorShopRejected(
                        order.getTownId(),
                        contact.userId(),
                        contact.phone(),
                        order.getId(),
                        order.getOrderNumber(),
                        shopName,
                        amount,
                        reason,
                        order.getBuyerPhoneSnapshot());
            }
        } catch (RuntimeException ex) {
            log.warn("Hub reject notify failed for order {}: {}", order.getId(), ex.toString());
        }
    }

    /**
     * COD cash-due shrinks with order totals — wallet credit would double-benefit the buyer.
     * ONLINE (already captured) needs store credit / refund path instead.
     */
    private static boolean shouldIssueStoreCredit(Order order) {
        return order.getPaymentMethod() != PaymentMethod.COD;
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
                .placedAt(subOrder.getOrder().getPlacedAt())
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
