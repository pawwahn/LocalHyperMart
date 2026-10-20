package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.dto.response.DeliveredVendorTown;
import com.hyperlocalmart.order.dto.response.SettlementBagKey;
import com.hyperlocalmart.order.dto.response.SettlementCandidateResponse;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.repository.VendorSubOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class SettlementCandidateService {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final VendorSubOrderRepository vendorSubOrderRepository;

    /**
     * Lists vendor bags eligible for payout: status must be {@code DELIVERED}
     * and placed date within {@code [from, to]} (IST calendar days).
     */
    @Transactional(readOnly = true)
    public SettlementCandidateResponse listCandidates(UUID vendorId, UUID townId, LocalDate from, LocalDate to) {
        // Match admin From/To calendar days in IST (not UTC midnight).
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        List<VendorSubOrder> rows = vendorSubOrderRepository.findSettlementCandidates(vendorId, townId, start, end);
        return SettlementCandidateResponse.builder()
                .vendorId(vendorId)
                .townId(townId)
                .from(from.toString())
                .to(to.toString())
                .items(rows.stream().map(this::toItem).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public List<SettlementBagKey> listBagKeys(LocalDate from, LocalDate to) {
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        List<SettlementBagKey> out = new ArrayList<>();
        for (Object[] row : vendorSubOrderRepository.findSettlementBagKeys(start, end)) {
            if (row == null || row.length < 3) {
                continue;
            }
            UUID vendorId = uuid(row[0]);
            UUID townId = uuid(row[1]);
            UUID subOrderId = uuid(row[2]);
            if (vendorId == null || townId == null || subOrderId == null) {
                continue;
            }
            out.add(new SettlementBagKey(vendorId, townId, subOrderId));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<DeliveredVendorTown> listDeliveredVendorTowns(LocalDate from, LocalDate to) {
        Instant start = from.atStartOfDay(IST).toInstant();
        Instant end = to.plusDays(1).atStartOfDay(IST).toInstant();
        List<DeliveredVendorTown> out = new ArrayList<>();
        for (Object[] row : vendorSubOrderRepository.findDeliveredVendorTowns(start, end)) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            out.add(new DeliveredVendorTown(UUID.fromString(row[0].toString()), UUID.fromString(row[1].toString())));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public List<SettlementCandidateResponse.Item> resolveSubOrders(UUID vendorId, Collection<UUID> subOrderIds) {
        if (subOrderIds == null || subOrderIds.isEmpty()) {
            return List.of();
        }
        return vendorSubOrderRepository.findByVendorIdAndIdIn(vendorId, subOrderIds).stream()
                .map(this::toItem)
                .toList();
    }

    private static UUID uuid(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof UUID id) {
            return id;
        }
        return UUID.fromString(value.toString());
    }

    /** Shop-agent money follows this bag. A sibling bag on the same order can still be a hub bag. */
    private static boolean isShopAgentBag(VendorSubOrder subOrder) {
        if (subOrder.getVendorAgentDeliveryAt() != null) {
            return true;
        }
        Order order = subOrder.getOrder();
        if (order == null || !order.isVendorAgentDelivery() || order.getVendorSubOrders() == null) {
            return false;
        }
        long activeBags = order.getVendorSubOrders().stream()
                .filter(bag -> !bag.getStatus().isClosed())
                .count();
        return activeBags <= 1;
    }

    private SettlementCandidateResponse.Item toItem(VendorSubOrder subOrder) {
        return SettlementCandidateResponse.Item.builder()
                .subOrderId(subOrder.getId())
                .orderId(subOrder.getOrder().getId())
                .orderNumber(subOrder.getOrder().getOrderNumber())
                .subOrderNumber(subOrder.getSubOrderNumber())
                .placedAt(subOrder.getOrder().getPlacedAt())
                .deliveredAt(subOrder.getOrder().getDeliveredAt())
                .status(subOrder.getStatus())
                .paymentStatus(subOrder.getOrder().getPaymentStatus())
                .paymentMethod(subOrder.getOrder().getPaymentMethod())
                .vendorAgentDelivery(isShopAgentBag(subOrder))
                .subtotal(subOrder.getSubtotal())
                .build();
    }
}
