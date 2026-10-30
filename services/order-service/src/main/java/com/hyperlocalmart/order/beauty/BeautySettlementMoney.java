package com.hyperlocalmart.order.beauty;

import com.hyperlocalmart.order.entity.BeautyOrder;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Glam payout direction: KoyaKart pays vendor vs shop-held visit cash. */
public final class BeautySettlementMoney {

    private BeautySettlementMoney() {
    }

    public static BigDecimal orderTotal(BeautyOrder order) {
        if (order.getAmountDueTotal() != null && order.getAmountDueTotal().signum() > 0) {
            return money(order.getAmountDueTotal());
        }
        return money(order.getServiceAmount())
                .add(money(order.getTravelCharge()))
                .add(money(order.getPlatformFeeAmount()))
                .add(money(order.getCodFee()))
                .add(money(order.getParlourPaymentFee()));
    }

    /**
     * True when the artist holds buyer cash (visit / COD). False when successful UPI covers the full booking —
     * then KoyaKart pays the vendor on Accounts → Pay.
     *
     * @param successfulOnlineTotal sum of SUCCESS gateway payments (not visit cash)
     */
    public static boolean vendorHoldsVisitCash(BeautyOrder order, BigDecimal successfulOnlineTotal) {
        if (order.getStatus() != BeautyOrderStatus.COMPLETED) {
            return false;
        }
        if (order.getPaymentMethod() == BeautyPaymentMethod.CASH) {
            return true;
        }
        BigDecimal total = orderTotal(order);
        if (total.signum() <= 0) {
            return false;
        }
        BigDecimal online = money(successfulOnlineTotal);
        if (online.compareTo(total) >= 0) {
            return false;
        }
        BigDecimal stored = money(order.getAmountCollected());
        if (stored.compareTo(online) > 0) {
            return true;
        }
        String mode = order.getPrepayMode() == null ? "" : order.getPrepayMode().trim();
        if ("PARTIAL".equalsIgnoreCase(mode) && online.compareTo(total) < 0) {
            return true;
        }
        return online.signum() <= 0 && !"FULL".equalsIgnoreCase(mode);
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }
}
