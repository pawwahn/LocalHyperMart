package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.VendorSubOrder;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** Hydrate {@link Order#getVendorSubOrders()} so buyer-fee shares split correctly across bags. */
final class OrderSiblingBags {

    private OrderSiblingBags() {}

    static void attach(List<VendorSubOrder> seedRows, List<VendorSubOrder> allBagsOnOrders) {
        if (seedRows == null || seedRows.isEmpty()) {
            return;
        }
        Map<UUID, List<VendorSubOrder>> activeByOrder = new LinkedHashMap<>();
        for (VendorSubOrder bag : allBagsOnOrders == null ? List.<VendorSubOrder>of() : allBagsOnOrders) {
            if (bag == null || bag.getOrder() == null || bag.getStatus().isClosed()) {
                continue;
            }
            activeByOrder.computeIfAbsent(bag.getOrder().getId(), ignored -> new ArrayList<>()).add(bag);
        }
        for (VendorSubOrder sub : seedRows) {
            if (sub == null || sub.getOrder() == null) {
                continue;
            }
            UUID orderId = sub.getOrder().getId();
            List<VendorSubOrder> siblings = activeByOrder.get(orderId);
            sub.getOrder().setVendorSubOrders(siblings == null || siblings.isEmpty() ? List.of(sub) : siblings);
        }
    }

    static List<UUID> distinctOrderIds(List<VendorSubOrder> rows) {
        return rows.stream()
                .filter(r -> r != null && r.getOrder() != null)
                .map(r -> r.getOrder().getId())
                .distinct()
                .collect(Collectors.toList());
    }
}
