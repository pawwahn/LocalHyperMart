package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Splits buyer COD collect amount across vendor bags on one order (mixed checkout).
 * Uses the same fee columns as {@link OrderService#buyerPayableTotal(Order)}.
 */
public final class CodCashAllocation {

    private CodCashAllocation() {}

    public record VendorSlice(
            UUID subOrderId,
            UUID vendorId,
            String subOrderNumber,
            BigDecimal goodsSubtotal,
            BigDecimal allocatedCash) {}

    public record OrderBreakdown(BigDecimal collectAmount, List<VendorSlice> vendorSlices) {}

    public static OrderBreakdown split(Order order, List<VendorSubOrder> subOrders) {
        BigDecimal collect = OrderService.buyerPayableTotal(order);
        if (collect.compareTo(BigDecimal.ZERO) <= 0) {
            return new OrderBreakdown(BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP), List.of());
        }

        List<VendorSubOrder> active = subOrders.stream()
                .filter(s -> s.getStatus() != VendorSubOrderStatus.VENDOR_REJECTED)
                .toList();
        if (active.isEmpty()) {
            return new OrderBreakdown(collect.setScale(2, RoundingMode.HALF_UP), List.of());
        }

        BigDecimal goodsTotal = BigDecimal.ZERO;
        List<BigDecimal> goodsPerBag = new ArrayList<>();
        for (VendorSubOrder sub : active) {
            BigDecimal bag = goodsSubtotal(sub);
            goodsPerBag.add(bag);
            goodsTotal = goodsTotal.add(bag);
        }

        BigDecimal promo = nz(order.getPromoDiscount());
        BigDecimal delivery = nz(order.getDeliveryFee());
        BigDecimal platform = nz(order.getPlatformFee());
        BigDecimal codFee = nz(order.getCodFee());
        BigDecimal wallet = nz(order.getStoreCreditApplied());

        List<VendorSlice> slices = new ArrayList<>();
        BigDecimal allocatedSum = BigDecimal.ZERO;
        for (int i = 0; i < active.size(); i++) {
            VendorSubOrder sub = active.get(i);
            BigDecimal share = shareOf(goodsPerBag.get(i), goodsTotal, active.size());
            BigDecimal promoShare = promo.multiply(share);
            BigDecimal payableGoods = goodsPerBag.get(i).subtract(promoShare).max(BigDecimal.ZERO);
            BigDecimal feeShare = delivery.add(platform).add(codFee).multiply(share);
            BigDecimal walletShare = wallet.multiply(share);
            BigDecimal slice = payableGoods.add(feeShare).subtract(walletShare);
            if (i == active.size() - 1) {
                slice = collect.subtract(allocatedSum);
            } else {
                slice = slice.setScale(2, RoundingMode.HALF_UP);
                allocatedSum = allocatedSum.add(slice);
            }
            slices.add(new VendorSlice(
                    sub.getId(),
                    sub.getVendorId(),
                    sub.getSubOrderNumber(),
                    goodsPerBag.get(i).setScale(2, RoundingMode.HALF_UP),
                    slice.setScale(2, RoundingMode.HALF_UP)));
        }

        return new OrderBreakdown(collect.setScale(2, RoundingMode.HALF_UP), slices);
    }

    private static BigDecimal goodsSubtotal(VendorSubOrder sub) {
        BigDecimal sum = BigDecimal.ZERO;
        if (sub.getItems() == null) {
            return sum;
        }
        for (OrderItem item : sub.getItems()) {
            if (item.getStatus() == OrderItemStatus.CANCELLED) {
                continue;
            }
            if (item.getLineTotal() != null) {
                sum = sum.add(item.getLineTotal());
            }
        }
        return sum;
    }

    private static BigDecimal shareOf(BigDecimal bagGoods, BigDecimal goodsTotal, int bagCount) {
        if (goodsTotal.compareTo(BigDecimal.ZERO) > 0) {
            return bagGoods.divide(goodsTotal, 8, RoundingMode.HALF_UP);
        }
        return BigDecimal.ONE.divide(BigDecimal.valueOf(bagCount), 8, RoundingMode.HALF_UP);
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
