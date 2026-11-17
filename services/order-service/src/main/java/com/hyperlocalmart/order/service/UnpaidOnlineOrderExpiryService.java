package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.client.NotificationClient;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.OrderStatusHistoryRepository;
import com.hyperlocalmart.order.entity.OrderStatusHistory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class UnpaidOnlineOrderExpiryService {

    public static final String EXPIRY_REASON =
            "Online payment not completed within 24 hours";

    private static final int BATCH_SIZE = 50;

    private final OrderRepository orderRepository;
    private final OrderStatusHistoryRepository orderStatusHistoryRepository;
    private final OrderMoneyUnwindService orderMoneyUnwindService;
    private final NotificationClient notificationClient;
    private final DeliveryClient deliveryClient;

    @Transactional
    public int expireStaleUnpaidOnlineOrders() {
        Instant cutoff = Instant.now().minus(1, ChronoUnit.DAYS);
        int total = 0;
        while (true) {
            List<UUID> batch = orderRepository.findIdsOfStaleUnpaidOnlineOrders(
                    cutoff, PageRequest.of(0, BATCH_SIZE));
            if (batch.isEmpty()) {
                break;
            }
            for (UUID orderId : batch) {
                if (expireOne(orderId, cutoff)) {
                    total++;
                }
            }
            if (batch.size() < BATCH_SIZE) {
                break;
            }
        }
        return total;
    }

    private boolean expireOne(UUID orderId, Instant cutoff) {
        Order order = orderRepository.findWithSubOrdersById(orderId).orElse(null);
        if (order == null) {
            return false;
        }
        if (order.getStatus() != OrderStatus.PAYMENT_PENDING
                || order.getPaymentMethod() != PaymentMethod.ONLINE) {
            return false;
        }
        if (order.getCreatedAt() == null || !order.getCreatedAt().isBefore(cutoff)) {
            return false;
        }

        try {
            deliveryClient.cancelActiveAssignmentsForOrder(orderId, EXPIRY_REASON);
        } catch (RuntimeException ex) {
            log.warn("Could not release delivery assignments for unpaid order {}: {}",
                    order.getOrderNumber(), ex.getMessage());
        }

        OrderStatus prior = order.getStatus();
        if (order.getVendorSubOrders() != null) {
            for (VendorSubOrder sub : order.getVendorSubOrders()) {
                if (sub.getStatus() == null || sub.getStatus().isClosed()
                        || sub.getStatus() == VendorSubOrderStatus.DELIVERED) {
                    continue;
                }
                VendorSubOrderStatus from = sub.getStatus();
                sub.setStatus(VendorSubOrderStatus.BUYER_CANCELLED);
                sub.setRejectReason(EXPIRY_REASON);
                orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                        .orderId(order.getId())
                        .vendorSubOrderId(sub.getId())
                        .fromStatus(from.name())
                        .toStatus(VendorSubOrderStatus.BUYER_CANCELLED.name())
                        .changedBy(null)
                        .changedByRole("SYSTEM")
                        .note(EXPIRY_REASON)
                        .build());
            }
        }

        order.setStatus(OrderStatus.CANCELLED);
        order.setCancelReason(EXPIRY_REASON);
        order.setCancelledAt(Instant.now());
        orderMoneyUnwindService.unwindCancelledOrder(order, EXPIRY_REASON);
        orderRepository.save(order);

        orderStatusHistoryRepository.save(OrderStatusHistory.builder()
                .orderId(order.getId())
                .fromStatus(prior.name())
                .toStatus(OrderStatus.CANCELLED.name())
                .changedBy(null)
                .changedByRole("SYSTEM")
                .note(EXPIRY_REASON)
                .build());

        notificationClient.notifyOrderCancelled(
                order.getTownId(),
                order.getId(),
                order.getBuyerId(),
                order.getBuyerPhoneSnapshot(),
                order.getOrderNumber(),
                EXPIRY_REASON);
        return true;
    }
}