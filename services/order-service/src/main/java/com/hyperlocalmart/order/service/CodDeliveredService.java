package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.dto.response.CodDeliveredResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.repository.OrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Collection;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Lists COD orders delivered on a calendar day (IST).
 * <p>
 * Gate A agent filter: when {@code agentId} is provided, prefer LAST_MILE assignment
 * matching from delivery-service. If no assignment data is available for any candidate,
 * returns town-level COD delivered for the day (documented limitation).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CodDeliveredService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final OrderRepository orderRepository;
    private final DeliveryClient deliveryClient;

    @Transactional(readOnly = true)
    public CodDeliveredResponse list(UUID townId, UUID agentId, LocalDate date) {
        Instant start = date.atStartOfDay(IST).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(IST).toInstant();
        List<Order> orders = orderRepository.findCodDeliveredByTownAndDeliveredAtBetween(townId, start, end);

        boolean agentFilterApplied = false;
        if (agentId != null && !orders.isEmpty()) {
            FilterResult filtered = filterByLastMileAgent(orders, agentId);
            agentFilterApplied = filtered.applied();
            orders = filtered.orders();
        }

        return CodDeliveredResponse.builder()
                .townId(townId)
                .agentId(agentId)
                .date(date.toString())
                .agentFilterApplied(agentFilterApplied)
                .items(orders.stream().map(this::toItem).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public List<CodDeliveredResponse.Item> resolve(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        return orderRepository.findCodDeliveredByIds(orderIds).stream()
                .map(this::toItem)
                .toList();
    }

    private FilterResult filterByLastMileAgent(List<Order> orders, UUID agentId) {
        boolean anyAssignmentData = false;
        List<Order> matched = new java.util.ArrayList<>();
        for (Order order : orders) {
            List<DeliveryClient.OrderAssignment> assignments = deliveryClient.getAssignmentsForOrder(order.getId());
            if (assignments == null || assignments.isEmpty()) {
                continue;
            }
            anyAssignmentData = true;
            boolean match = assignments.stream().anyMatch(a ->
                    "LAST_MILE".equalsIgnoreCase(a.legType())
                            && agentId.equals(a.agentId()));
            if (match) {
                matched.add(order);
            }
        }
        if (!anyAssignmentData) {
            log.info("COD delivered agent filter skipped for town day — no LAST_MILE assignment data; returning town list");
            return new FilterResult(orders, false);
        }
        return new FilterResult(matched, true);
    }

    private CodDeliveredResponse.Item toItem(Order order) {
        return CodDeliveredResponse.Item.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .totalAmount(order.getTotalAmount())
                .deliveredAt(order.getDeliveredAt())
                .build();
    }

    private record FilterResult(List<Order> orders, boolean applied) {
        FilterResult {
            Objects.requireNonNull(orders);
        }
    }
}
