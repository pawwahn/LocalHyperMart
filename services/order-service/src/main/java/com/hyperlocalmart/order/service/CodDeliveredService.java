package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.dto.response.CodCashBreakdownResponse;
import com.hyperlocalmart.order.dto.response.CodDeliveredResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
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
    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final DeliveryClient deliveryClient;

    @Transactional(readOnly = true)
    public CodDeliveredResponse listRange(UUID townId, UUID agentId, LocalDate from, LocalDate to) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("from and to are required (from <= to)");
        }
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        List<Order> orders = orderRepository.findCodDeliveredByTownAndDeliveredAtBetween(townId, start, end);

        boolean agentFilterApplied = false;
        if (agentId != null && !orders.isEmpty()) {
            FilterResult filtered = filterByDeliveringAgent(orders, agentId);
            agentFilterApplied = filtered.applied();
            orders = filtered.orders();
        }

        return CodDeliveredResponse.builder()
                .townId(townId)
                .agentId(agentId)
                .date(from + ".." + to)
                .agentFilterApplied(agentFilterApplied)
                .items(orders.stream().map(this::toItem).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public CodDeliveredResponse list(UUID townId, UUID agentId, LocalDate date) {
        Instant start = date.atStartOfDay(IST).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(IST).toInstant();
        List<Order> orders = orderRepository.findCodDeliveredByTownAndDeliveredAtBetween(townId, start, end);

        boolean agentFilterApplied = false;
        if (agentId != null && !orders.isEmpty()) {
            FilterResult filtered = filterByDeliveringAgent(orders, agentId);
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

    private FilterResult filterByDeliveringAgent(List<Order> orders, UUID agentId) {
        boolean anyAssignmentData = false;
        List<Order> matched = new java.util.ArrayList<>();
        for (Order order : orders) {
            UUID deliveringAgent = resolveDeliveringAgentId(order.getId());
            if (deliveringAgent != null) {
                anyAssignmentData = true;
            }
            if (agentId.equals(deliveringAgent)) {
                matched.add(order);
            }
        }
        if (!anyAssignmentData) {
            log.info("COD delivered agent filter skipped for town day — no delivery assignment data; returning town list");
            return new FilterResult(orders, false);
        }
        return new FilterResult(matched, true);
    }

    /**
     * Same delivering-agent rules as delivery payout legs (vendor-direct, else last-mile).
     */
    private UUID resolveDeliveringAgentId(UUID orderId) {
        List<DeliveryClient.OrderAssignment> assignments = deliveryClient.getAssignmentsForOrder(orderId);
        if (assignments == null || assignments.isEmpty()) {
            return null;
        }
        DeliveryClient.OrderAssignment vendorDirect = latestCompleted(assignments, "VENDOR_DIRECT");
        if (vendorDirect != null) {
            return vendorDirect.agentId();
        }
        DeliveryClient.OrderAssignment lastMile = latestCompleted(assignments, "LAST_MILE");
        return lastMile != null ? lastMile.agentId() : null;
    }

    private static DeliveryClient.OrderAssignment latestCompleted(
            List<DeliveryClient.OrderAssignment> assignments, String legType) {
        DeliveryClient.OrderAssignment best = null;
        for (DeliveryClient.OrderAssignment a : assignments) {
            if (!legType.equalsIgnoreCase(a.legType()) || !"COMPLETED".equalsIgnoreCase(a.status())) {
                continue;
            }
            if (best == null || completedAfter(a, best)) {
                best = a;
            }
        }
        return best;
    }

    private static boolean completedAfter(DeliveryClient.OrderAssignment a, DeliveryClient.OrderAssignment b) {
        java.time.Instant at = a.completedAt() != null ? a.completedAt() : java.time.Instant.EPOCH;
        java.time.Instant bt = b.completedAt() != null ? b.completedAt() : java.time.Instant.EPOCH;
        return at.isAfter(bt);
    }

    private static boolean isHomeDeliveryLeg(String legType) {
        return "LAST_MILE".equalsIgnoreCase(legType) || "VENDOR_DIRECT".equalsIgnoreCase(legType);
    }

    @Transactional(readOnly = true)
    public List<CodCashBreakdownResponse> breakdown(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        return orderRepository.findCodDeliveredByIds(orderIds).stream()
                .map(this::toBreakdown)
                .toList();
    }

    private CodDeliveredResponse.Item toItem(Order order) {
        return CodDeliveredResponse.Item.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .totalAmount(OrderService.buyerPayableTotal(order))
                .deliveredAt(order.getDeliveredAt())
                .build();
    }

    private CodCashBreakdownResponse toBreakdown(Order order) {
        if (order.getPaymentMethod() != PaymentMethod.COD) {
            throw new IllegalArgumentException("Order is not COD: " + order.getId());
        }
        List<VendorSubOrder> subOrders = vendorSubOrderRepository.findByOrderIdWithItems(order.getId());
        CodCashAllocation.OrderBreakdown split = CodCashAllocation.split(order, subOrders);
        String custodianType = order.isVendorAgentDelivery() ? "VENDOR" : "HUB";
        UUID vendorId = order.isVendorAgentDelivery() ? soleVendorId(subOrders) : null;
        UUID hubId = order.isVendorAgentDelivery() ? null : resolveTownHubId(order.getTownId());

        return CodCashBreakdownResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .deliveredAt(order.getDeliveredAt())
                .collectAmount(split.collectAmount())
                .custodianType(custodianType)
                .hubId(hubId)
                .vendorId(vendorId)
                .vendorAllocations(split.vendorSlices().stream()
                        .map(s -> CodCashBreakdownResponse.VendorAllocation.builder()
                                .subOrderId(s.subOrderId())
                                .vendorId(s.vendorId())
                                .subOrderNumber(s.subOrderNumber())
                                .goodsSubtotal(s.goodsSubtotal())
                                .allocatedCash(s.allocatedCash())
                                .build())
                        .toList())
                .build();
    }

    private UUID resolveTownHubId(UUID townId) {
        if (townId == null) {
            return null;
        }
        List<DeliveryClient.HubContact> hubs = deliveryClient.listHubContactsForTown(townId);
        if (hubs == null || hubs.isEmpty()) {
            return null;
        }
        return hubs.getFirst().hubId();
    }

    private static UUID soleVendorId(List<VendorSubOrder> subOrders) {
        return subOrders.stream()
                .filter(s -> s.getStatus() != com.hyperlocalmart.order.entity.VendorSubOrderStatus.VENDOR_REJECTED)
                .map(VendorSubOrder::getVendorId)
                .findFirst()
                .orElse(null);
    }

    private record FilterResult(List<Order> orders, boolean applied) {
        FilterResult {
            Objects.requireNonNull(orders);
        }
    }
}
