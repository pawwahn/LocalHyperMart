package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.VendorSubOrder;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Comparator;
import java.util.List;

/** Split order-level buyer charges (platform / COD) across active vendor bags by goods share. */
final class OrderBuyerFeeShare {

    private OrderBuyerFeeShare() {}

    static BigDecimal deliveryFee(VendorSubOrder subOrder) {
        Order order = subOrder.getOrder();
        BigDecimal fee = order.getDeliveryFee() == null ? BigDecimal.ZERO : order.getDeliveryFee();
        return allocate(fee, subOrder);
    }

    static BigDecimal platformFee(VendorSubOrder subOrder) {
        Order order = subOrder.getOrder();
        BigDecimal fee = order.getPlatformFee() == null ? BigDecimal.ZERO : order.getPlatformFee();
        return allocate(fee, subOrder);
    }

    static BigDecimal codFee(VendorSubOrder subOrder) {
        Order order = subOrder.getOrder();
        BigDecimal fee = order.getCodFee() == null ? BigDecimal.ZERO : order.getCodFee();
        return allocate(fee, subOrder);
    }

    /** Bundled buyer membership / delivery plan — platform revenue, not shop goods. */
    static BigDecimal membershipFee(VendorSubOrder subOrder) {
        Order order = subOrder.getOrder();
        BigDecimal fee = order.getMembershipFee() == null ? BigDecimal.ZERO : order.getMembershipFee();
        return allocate(fee, subOrder);
    }

    private static BigDecimal allocate(BigDecimal fee, VendorSubOrder subOrder) {
        if (fee.signum() <= 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        Order order = subOrder.getOrder();
        List<VendorSubOrder> active = order.getVendorSubOrders() == null
                ? List.of(subOrder)
                : order.getVendorSubOrders().stream().filter(bag -> !bag.getStatus().isClosed()).toList();
        if (active.size() <= 1) {
            return fee.setScale(2, RoundingMode.HALF_UP);
        }
        List<VendorSubOrder> ordered = active.stream()
                .sorted(Comparator.comparing(VendorSubOrder::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        BigDecimal goodsTotal = ordered.stream()
                .map(bag -> bag.getSubtotal() == null ? BigDecimal.ZERO : bag.getSubtotal())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal allocated = BigDecimal.ZERO;
        for (int i = 0; i < ordered.size(); i++) {
            BigDecimal share;
            if (i == ordered.size() - 1) {
                share = fee.subtract(allocated);
            } else if (goodsTotal.signum() <= 0) {
                share = fee.divide(BigDecimal.valueOf(ordered.size()), 2, RoundingMode.HALF_UP);
                allocated = allocated.add(share);
            } else {
                BigDecimal bagGoods = ordered.get(i).getSubtotal() == null ? BigDecimal.ZERO : ordered.get(i).getSubtotal();
                share = fee.multiply(bagGoods).divide(goodsTotal, 2, RoundingMode.HALF_UP);
                allocated = allocated.add(share);
            }
            if (ordered.get(i).getId().equals(subOrder.getId())) {
                return share.max(BigDecimal.ZERO).setScale(2, RoundingMode.HALF_UP);
            }
        }
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
