package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.dto.request.CancelOrderItemRequest;
import com.hyperlocalmart.order.dto.request.CancelOrderRequest;
import com.hyperlocalmart.order.entity.*;
import com.hyperlocalmart.order.repository.OrderItemRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderStatusHistoryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Buyer-initiated cancel before shop pickup (Wave A #3).
 * Whole-order cancel while all shops still PLACED; item cancel while that shop is still PLACED.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class BuyerOrderCancelService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final PaymentClient paymentClient;
    private final NotificationClient notificationClient;
    private final OrderMoneyUnwindService orderMoneyUnwindService;

    @Transactional
    public void cancelOrder(UUID buyerId, UUID orderId, CancelOrderRequest request) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));

        if (order.getStatus() == OrderStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order is already cancelled");
        }
        if (order.getStatus() == OrderStatus.DELIVERED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Delivered orders cannot be cancelled");
        }

        if (order.getStatus() == OrderStatus.PAYMENT_PENDING
                || order.getStatus() == OrderStatus.PAYMENT_FAILED) {
            cancelUnpaidOrder(order, buyerId, request.getReason());
            return;
        }

        if (order.getStatus() != OrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Order cannot be cancelled in its current status");
        }

        boolean anyPastPlaced = order.getVendorSubOrders().stream()
                .anyMatch(s -> s.getStatus() != VendorSubOrderStatus.PLACED
                        && s.getStatus() != VendorSubOrderStatus.VENDOR_REJECTED);
        if (anyPastPlaced) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Cannot cancel the whole order — a shop has already marked items ready. Cancel individual items still waiting, or contact support.");
        }

        boolean hasActive = order.getVendorSubOrders().stream()
                .flatMap(s -> s.getItems().stream())
                .anyMatch(i -> i.getStatus() == null || i.getStatus() == OrderItemStatus.ACTIVE);
        if (!hasActive) {
            throw new BusinessException(ErrorCode.CONFLICT, "No active items left to cancel");
        }

        OrderStatus prior = order.getStatus();
        String reason = request.getReason();

        BigDecimal codCreditTotal = BigDecimal.ZERO;
        for (VendorSubOrder sub : order.getVendorSubOrders()) {
            if (sub.getItems() != null) {
                for (OrderItem item : sub.getItems()) {
                    if (item.getStatus() != null && item.getStatus() != OrderItemStatus.ACTIVE) {
                        continue;
                    }
                    BigDecimal line = item.getLineTotal() == null ? BigDecimal.ZERO : item.getLineTotal();
                    item.setStatus(OrderItemStatus.CANCELLED);
                    item.setCancelReason("Buyer cancelled order: " + reason);
                    item.setCancelledAt(Instant.now());
                    item.setCancelledBy(buyerId);
                    if (order.getPaymentMethod() == PaymentMethod.COD && line.compareTo(BigDecimal.ZERO) > 0) {
                        item.setStoreCreditAmount(line);
                        codCreditTotal = codCreditTotal.add(line);
                    }
                }
            }
            if (sub.getStatus() == VendorSubOrderStatus.PLACED) {
                VendorSubOrderStatus from = sub.getStatus();
                sub.setStatus(VendorSubOrderStatus.VENDOR_REJECTED);
                sub.setRejectReason("Buyer cancelled: " + reason);
                orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                        .orderId(order.getId())
                        .vendorSubOrderId(sub.getId())
                        .fromStatus(from.name())
                        .toStatus(VendorSubOrderStatus.VENDOR_REJECTED.name())
                        .changedBy(buyerId)
                        .changedByRole("BUYER")
                        .note("Buyer cancelled order: " + reason)
                        .build());
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelReason(reason);
        order.setCancelledAt(Instant.now());
        orderRepository.saveAndFlush(order);

        if (order.getPaymentMethod() == PaymentMethod.COD && codCreditTotal.compareTo(BigDecimal.ZERO) > 0) {
            try {
                paymentClient.creditWallet(
                        order.getBuyerId(),
                        codCreditTotal,
                        "ORDER_CANCEL",
                        order.getId(),
                        order.getId(),
                        null,
                        "Buyer cancelled order: " + order.getOrderNumber());
            } catch (RuntimeException ex) {
                log.error("Wallet credit failed while buyer cancelled order {}", orderId, ex);
                throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                        "Could not credit your wallet. Try again in a moment.");
            }
        }

        OrderMoneyUnwindService.UnwindResult unwind =
                orderMoneyUnwindService.unwindCancelledOrder(order, reason);

        orderRepository.save(order);
        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .fromStatus(prior.name())
                .toStatus(OrderStatus.CANCELLED.name())
                .changedBy(buyerId)
                .changedByRole("BUYER")
                .note("Buyer cancelled: " + reason)
                .build());

        notificationClient.notifyOrderCancelled(
                order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                order.getOrderNumber(), reason);
        if (unwind.gatewayRefunded()) {
            notificationClient.notifyRefundInitiated(
                    order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                    order.getOrderNumber(), unwind.gatewayRefundAmount(), 5);
        }
    }

    @Transactional
    public void cancelItem(UUID buyerId, UUID orderId, UUID itemId, CancelOrderItemRequest request) {
        Order order = orderRepository.findDetailedByIdAndBuyerId(orderId, buyerId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Order not found"));

        if (order.getStatus() != OrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "Items can only be cancelled after the order is placed and before delivery");
        }

        OrderItem item = null;
        VendorSubOrder subOrder = null;
        for (VendorSubOrder sub : order.getVendorSubOrders()) {
            for (OrderItem candidate : sub.getItems()) {
                if (candidate.getId().equals(itemId)) {
                    item = candidate;
                    subOrder = sub;
                    break;
                }
            }
            if (item != null) {
                break;
            }
        }
        if (item == null || subOrder == null) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Order item not found");
        }
        if (subOrder.getStatus() != VendorSubOrderStatus.PLACED) {
            throw new BusinessException(ErrorCode.CONFLICT,
                    "This shop has already started packing. Item can no longer be cancelled.");
        }
        if (item.getStatus() == OrderItemStatus.CANCELLED) {
            throw new BusinessException(ErrorCode.CONFLICT, "Item already cancelled");
        }

        BigDecimal creditAmount = item.getLineTotal();
        boolean issueStoreCredit = true;
        item.setStatus(OrderItemStatus.CANCELLED);
        item.setCancelReason(request.getReason());
        item.setCancelledAt(Instant.now());
        item.setCancelledBy(buyerId);
        item.setStoreCreditAmount(issueStoreCredit ? creditAmount : null);

        orderRepository.saveAndFlush(order);
        recalculateTotals(subOrder, order);

        boolean subOrderEmpty = subOrder.getItems().stream()
                .noneMatch(i -> i.getStatus() == null || i.getStatus() == OrderItemStatus.ACTIVE);
        if (subOrderEmpty) {
            subOrder.setStatus(VendorSubOrderStatus.VENDOR_REJECTED);
            subOrder.setRejectReason("Buyer cancelled items: " + request.getReason());
            orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                    .orderId(order.getId())
                    .vendorSubOrderId(subOrder.getId())
                    .fromStatus(VendorSubOrderStatus.PLACED.name())
                    .toStatus(VendorSubOrderStatus.VENDOR_REJECTED.name())
                    .changedBy(buyerId)
                    .changedByRole("BUYER")
                    .note("Buyer cancelled all items from shop: " + request.getReason())
                    .build());
        }

        BigDecimal remainingActive = orderItemRepository.sumActiveLineTotalsForOrder(order.getId());
        boolean orderEmpty = remainingActive == null || remainingActive.compareTo(BigDecimal.ZERO) == 0;

        if (orderEmpty) {
            OrderStatus prior = order.getStatus();
            order.setStatus(OrderStatus.CANCELLED);
            order.setCancelReason(request.getReason());
            order.setCancelledAt(Instant.now());
            orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                    .orderId(order.getId())
                    .fromStatus(prior.name())
                    .toStatus(OrderStatus.CANCELLED.name())
                    .changedBy(buyerId)
                    .changedByRole("BUYER")
                    .note("Buyer cancelled all items: " + request.getReason())
                    .build());

            // COD: credit this last cancelled line (ONLINE relies on gateway refund in unwind).
            if (order.getPaymentMethod() == PaymentMethod.COD
                    && creditAmount != null
                    && creditAmount.compareTo(BigDecimal.ZERO) > 0) {
                item.setStoreCreditAmount(creditAmount);
                try {
                    paymentClient.creditWallet(
                            order.getBuyerId(),
                            creditAmount,
                            "ORDER_ITEM_CANCEL",
                            itemId,
                            order.getId(),
                            item.getId(),
                            "Buyer cancelled item: " + item.getItemNameSnapshot());
                } catch (RuntimeException ex) {
                    log.error("Wallet credit failed while buyer cancelled last item {}", itemId, ex);
                    throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                            "Could not credit your wallet. Try again in a moment.");
                }
            } else {
                item.setStoreCreditAmount(null);
            }

            // Convert to whole-order money model (reverse prior ONLINE item credits + refund capture).
            OrderMoneyUnwindService.UnwindResult unwind =
                    orderMoneyUnwindService.unwindCancelledOrder(order, request.getReason(), itemId);
            orderRepository.save(order);

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
            return;
        }

        orderRepository.save(order);

        if (!issueStoreCredit) {
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
                log.warn("Buyer COD cancel notification failed for item {}: {}", itemId, ex.toString());
            }
            return;
        }

        BigDecimal balance;
        try {
            balance = paymentClient.creditWallet(
                    order.getBuyerId(),
                    creditAmount,
                    "ORDER_ITEM_CANCEL",
                    itemId,
                    order.getId(),
                    item.getId(),
                    "Buyer cancelled item: " + item.getItemNameSnapshot());
        } catch (RuntimeException ex) {
            log.error("Wallet credit failed while buyer cancelled item {}", itemId, ex);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                    "Could not credit your wallet. Try again in a moment.");
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
            log.warn("Buyer cancel notification failed for item {}: {}", itemId, ex.toString());
        }
    }

    private void cancelUnpaidOrder(Order order, UUID buyerId, String reason) {
        OrderStatus prior = order.getStatus();
        for (VendorSubOrder sub : order.getVendorSubOrders()) {
            if (sub.getStatus() == VendorSubOrderStatus.PLACED) {
                sub.setStatus(VendorSubOrderStatus.VENDOR_REJECTED);
                sub.setRejectReason("Buyer cancelled: " + reason);
            }
        }
        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelReason(reason);
        order.setCancelledAt(Instant.now());
        orderMoneyUnwindService.unwindCancelledOrder(order, reason);
        orderRepository.save(order);
        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .fromStatus(prior.name())
                .toStatus(OrderStatus.CANCELLED.name())
                .changedBy(buyerId)
                .changedByRole("BUYER")
                .note("Buyer cancelled unpaid order: " + reason)
                .build());
        notificationClient.notifyOrderCancelled(
                order.getTownId(), order.getId(), order.getBuyerId(), order.getBuyerPhoneSnapshot(),
                order.getOrderNumber(), reason);
    }

    private void recalculateTotals(VendorSubOrder subOrder, Order order) {
        BigDecimal newSubtotal = sumActiveFromItems(subOrder.getItems());
        subOrder.setSubtotal(newSubtotal);
        orderRepository.saveAndFlush(order);

        BigDecimal newItemsSubtotal = orderItemRepository.sumActiveLineTotalsForOrder(order.getId());
        if (newItemsSubtotal == null) {
            newItemsSubtotal = BigDecimal.ZERO;
        }
        order.setItemsSubtotal(newItemsSubtotal);
        BigDecimal promo = order.getPromoDiscount() == null ? BigDecimal.ZERO : order.getPromoDiscount();
        BigDecimal payableItems = newItemsSubtotal.subtract(promo).max(BigDecimal.ZERO);
        boolean orderEmpty = newItemsSubtotal.compareTo(BigDecimal.ZERO) == 0;
        BigDecimal delivery = orderEmpty
                ? BigDecimal.ZERO
                : (order.getDeliveryFee() == null ? BigDecimal.ZERO : order.getDeliveryFee());
        if (orderEmpty) {
            order.setDeliveryFee(BigDecimal.ZERO);
        }
        BigDecimal newTotal = payableItems.add(delivery);
        BigDecimal creditApplied = order.getStoreCreditApplied() == null ? BigDecimal.ZERO : order.getStoreCreditApplied();
        order.setTotalAmount(newTotal.subtract(creditApplied).max(BigDecimal.ZERO));
    }

    private static BigDecimal sumActiveFromItems(java.util.List<OrderItem> items) {
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
}
