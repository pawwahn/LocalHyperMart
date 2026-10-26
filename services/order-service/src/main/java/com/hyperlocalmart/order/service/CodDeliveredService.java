package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.DeliveryClient;
import com.hyperlocalmart.order.dto.response.CodCashBreakdownResponse;
import com.hyperlocalmart.order.dto.response.CodDeliveredResponse;
import com.hyperlocalmart.order.entity.LaundryOrder;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.repository.LaundryOrderRepository;
import com.hyperlocalmart.order.repository.OrderRepository;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
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
    private final LaundryOrderRepository laundryOrderRepository;
    private final VendorSubOrderRepository vendorSubOrderRepository;
    private final DeliveryClient deliveryClient;

    @Transactional(readOnly = true)
    public CodDeliveredResponse listRange(UUID townId, UUID agentId, LocalDate from, LocalDate to) {
        return listRange(townId, agentId, from, to, null);
    }

    /**
     * @param vendorAgentDelivery when non-null, SQL-filters hub-route vs shop-agent COD (avoids loading all town COD).
     */
    @Transactional(readOnly = true)
    public CodDeliveredResponse listRange(
            UUID townId, UUID agentId, LocalDate from, LocalDate to, Boolean vendorAgentDelivery) {
        if (from == null || to == null || to.isBefore(from)) {
            throw new IllegalArgumentException("from and to are required (from <= to)");
        }
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        List<CodDeliveredResponse.Item> items;
        boolean agentFilterApplied = false;
        if (agentId != null) {
            items = listCodDeliveredItemsForAgent(townId, agentId, start, end, vendorAgentDelivery);
            agentFilterApplied = true;
        } else {
            List<Order> orders = vendorAgentDelivery == null
                    ? orderRepository.findCodDeliveredByTownAndDeliveredAtBetween(townId, start, end)
                    : orderRepository.findCodDeliveredByTownAndDeliveredAtBetweenAndVendorAgentDelivery(
                            townId, start, end, vendorAgentDelivery);
            items = new ArrayList<>(orders.stream().map(this::toItem).toList());
            if (vendorAgentDelivery == null || vendorAgentDelivery) {
                items.addAll(listTownLaundryCashDelivered(townId, start, end));
            }
        }

        return CodDeliveredResponse.builder()
                .townId(townId)
                .agentId(agentId)
                .date(from + ".." + to)
                .agentFilterApplied(agentFilterApplied)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public CodDeliveredResponse list(UUID townId, UUID agentId, LocalDate date) {
        Instant start = date.atStartOfDay(IST).toInstant();
        Instant end = date.plusDays(1).atStartOfDay(IST).toInstant();
        if (agentId != null) {
            return CodDeliveredResponse.builder()
                    .townId(townId)
                    .agentId(agentId)
                    .date(date.toString())
                    .agentFilterApplied(true)
                    .items(listCodDeliveredItemsForAgent(townId, agentId, start, end, null))
                    .build();
        }
        List<CodDeliveredResponse.Item> items = new ArrayList<>(
                orderRepository.findCodDeliveredByTownAndDeliveredAtBetween(townId, start, end).stream()
                        .map(this::toItem)
                        .toList());
        items.addAll(listTownLaundryCashDelivered(townId, start, end));

        return CodDeliveredResponse.builder()
                .townId(townId)
                .agentId(null)
                .date(date.toString())
                .agentFilterApplied(false)
                .items(items)
                .build();
    }

    @Transactional(readOnly = true)
    public List<CodDeliveredResponse.Item> resolve(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        List<CodDeliveredResponse.Item> items = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (Order order : orderRepository.findCodDeliveredByIds(orderIds)) {
            items.add(toItem(order));
            seen.add(order.getId());
        }
        for (LaundryOrder order : laundryOrderRepository.findCashDeliveredByIds(orderIds)) {
            if (seen.add(order.getId())) {
                items.add(toLaundryItem(order));
            }
        }
        return items;
    }

    private List<CodDeliveredResponse.Item> listCodDeliveredItemsForAgent(
            UUID townId, UUID agentId, Instant start, Instant end, Boolean vendorAgentDelivery) {
        List<UUID> orderIds = deliveryClient.listAgentCompletedDeliveryOrderIds(agentId, start, end);
        if (orderIds.isEmpty()) {
            return List.of();
        }
        List<CodDeliveredResponse.Item> items = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (Order order : orderRepository.findCodDeliveredByIds(orderIds)) {
            if (!townId.equals(order.getTownId())) {
                continue;
            }
            if (order.getDeliveredAt() == null
                    || order.getDeliveredAt().isBefore(start)
                    || !order.getDeliveredAt().isBefore(end)) {
                continue;
            }
            if (vendorAgentDelivery != null && order.isVendorAgentDelivery() != vendorAgentDelivery) {
                continue;
            }
            items.add(toItem(order));
            seen.add(order.getId());
        }
        if (vendorAgentDelivery != null && !vendorAgentDelivery) {
            return items;
        }
        for (LaundryOrder order : laundryOrderRepository.findCashDeliveredByIds(orderIds)) {
            if (seen.contains(order.getId()) || !townId.equals(order.getTownId())) {
                continue;
            }
            if (order.getDeliveredAt().isBefore(start) || !order.getDeliveredAt().isBefore(end)) {
                continue;
            }
            items.add(toLaundryItem(order));
        }
        return items;
    }

    private List<CodDeliveredResponse.Item> listTownLaundryCashDelivered(
            UUID townId, Instant start, Instant end) {
        return laundryOrderRepository.findCashDeliveredByTownAndDeliveredAtBetween(townId, start, end).stream()
                .map(this::toLaundryItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CodCashBreakdownResponse> breakdown(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        List<CodCashBreakdownResponse> out = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();
        for (Order order : orderRepository.findCodDeliveredByIds(orderIds)) {
            out.add(toBreakdown(order));
            seen.add(order.getId());
        }
        for (LaundryOrder order : laundryOrderRepository.findCashDeliveredByIds(orderIds)) {
            if (seen.add(order.getId())) {
                out.add(toLaundryBreakdown(order));
            }
        }
        return out;
    }

    private CodDeliveredResponse.Item toItem(Order order) {
        return CodDeliveredResponse.Item.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .totalAmount(OrderService.buyerPayableTotal(order))
                .deliveredAt(order.getDeliveredAt())
                .custodianType(order.isVendorAgentDelivery() ? "VENDOR" : "HUB")
                .build();
    }

    private CodDeliveredResponse.Item toLaundryItem(LaundryOrder order) {
        return CodDeliveredResponse.Item.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .totalAmount(laundryBuyerPayable(order))
                .deliveredAt(order.getDeliveredAt())
                .custodianType("VENDOR")
                .build();
    }

    private static BigDecimal laundryBuyerPayable(LaundryOrder order) {
        return moneyOrZero(order.getGoodsAmount())
                .add(moneyOrZero(order.getPlatformFeeAmount()))
                .add(moneyOrZero(order.getCodFee()))
                .setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal moneyOrZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
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

    private CodCashBreakdownResponse toLaundryBreakdown(LaundryOrder order) {
        BigDecimal collect = laundryBuyerPayable(order);
        BigDecimal goods = moneyOrZero(order.getGoodsAmount()).setScale(2, RoundingMode.HALF_UP);
        return CodCashBreakdownResponse.builder()
                .orderId(order.getId())
                .orderNumber(order.getOrderNumber())
                .deliveredAt(order.getDeliveredAt())
                .collectAmount(collect)
                .custodianType("VENDOR")
                .hubId(null)
                .vendorId(order.getVendorId())
                .vendorAllocations(List.of(CodCashBreakdownResponse.VendorAllocation.builder()
                        // Laundry has no grocery sub-order; order id is the allocation key for handover/settlement.
                        .subOrderId(order.getId())
                        .vendorId(order.getVendorId())
                        .subOrderNumber(order.getOrderNumber())
                        .goodsSubtotal(goods)
                        .allocatedCash(collect)
                        .build()))
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
                .filter(s -> !s.getStatus().isClosed())
                .map(VendorSubOrder::getVendorId)
                .findFirst()
                .orElse(null);
    }

}
