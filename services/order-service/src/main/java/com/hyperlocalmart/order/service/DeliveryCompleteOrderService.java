package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderStatus;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class DeliveryCompleteOrderService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final OrderRepository orderRepository;

    @Transactional(readOnly = true)
    public List<CompleteOrder> listDelivered(UUID townId, LocalDate from, LocalDate to) {
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        return orderRepository.findDeliveredByTownAndDeliveredAtBetween(townId, start, end).stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                .map(this::toItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CompleteOrder> resolveDelivered(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        return orderRepository.findDeliveredByIds(orderIds).stream()
                .filter(o -> o.getStatus() == OrderStatus.DELIVERED)
                .map(this::toItem)
                .toList();
    }

    private CompleteOrder toItem(Order o) {
        return new CompleteOrder(
                o.getId(),
                o.getTownId(),
                o.getOrderNumber(),
                o.getStatus().name(),
                o.getPaymentStatus() == null ? null : o.getPaymentStatus().name(),
                o.getDeliveredAt(),
                o.getTotalAmount());
    }

    public record CompleteOrder(
            UUID orderId,
            UUID townId,
            String orderNumber,
            String status,
            String paymentStatus,
            Instant deliveredAt,
            java.math.BigDecimal totalAmount
    ) {
    }
}
