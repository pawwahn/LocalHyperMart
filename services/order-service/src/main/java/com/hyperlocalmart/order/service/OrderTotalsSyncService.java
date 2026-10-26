package com.hyperlocalmart.order.service;

import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.entity.Order;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Keeps {@link Order#getTotalAmount()} and checkout store credit aligned when lines change.
 * Without clamping, cancelled items can leave store_credit_applied higher than the new gross —
 * COD collect and buyer payable drift from what was actually debited/collectible.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderTotalsSyncService {

    private final PaymentClient paymentClient;

    public void syncAfterLineChange(Order order) {
        if (order == null || order.getId() == null) {
            return;
        }
        BigDecimal gross = OrderService.grossBuyerTotal(order);
        if (gross.compareTo(BigDecimal.ZERO) <= 0) {
            order.setDeliveryFee(BigDecimal.ZERO);
            order.setPlatformFee(BigDecimal.ZERO);
            order.setCodFee(BigDecimal.ZERO);
        }

        BigDecimal credit = nz(order.getStoreCreditApplied());
        BigDecimal maxCredit = gross.max(BigDecimal.ZERO);
        BigDecimal capped = credit.min(maxCredit);
        if (capped.compareTo(credit) < 0) {
            BigDecimal restore = credit.subtract(capped);
            log.info("Adjusting checkout store credit on {} by +{}", order.getOrderNumber(), restore.toPlainString());
            paymentClient.creditWallet(
                    order.getBuyerId(),
                    restore,
                    "ORDER_CHECKOUT_CREDIT_CLAMP",
                    UUID.randomUUID(),
                    order.getId(),
                    null,
                    "Checkout store credit adjusted after order line change on " + order.getOrderNumber());
            order.setStoreCreditApplied(capped);
        }

        order.setTotalAmount(OrderService.buyerPayableTotal(order));
    }

    private static BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }
}
