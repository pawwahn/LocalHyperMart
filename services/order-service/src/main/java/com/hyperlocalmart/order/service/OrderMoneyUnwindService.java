package com.hyperlocalmart.order.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.client.PaymentClient;
import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderItem;
import com.hyperlocalmart.order.entity.OrderItemStatus;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Single money unwind for whole-order cancel / reject / last-item empty.
 * Reverses prior item-cancel wallet credits, restores checkout store credit,
 * and refunds the original successful gateway capture when present.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderMoneyUnwindService {

    private final PaymentClient paymentClient;

    public record UnwindResult(
            boolean gatewayRefunded,
            BigDecimal gatewayRefundAmount,
            boolean storeCreditRestored,
            BigDecimal storeCreditRestoredAmount
    ) {
        public static UnwindResult empty() {
            return new UnwindResult(false, BigDecimal.ZERO, false, BigDecimal.ZERO);
        }
    }

    /**
     * Call after the order is marked CANCELLED (or about to be saved as such).
     *
     * @param skipItemId item that was just cancelled but not yet wallet-credited (last-item path)
     */
    public UnwindResult unwindCancelledOrder(Order order, String reason, UUID skipItemId) {
        reversePriorItemCancelCredits(order, skipItemId, reason);
        clearItemCancelCredits(order, skipItemId);

        BigDecimal restoredCredit = restoreCheckoutStoreCredit(order, reason);
        boolean creditRestored = restoredCredit.compareTo(BigDecimal.ZERO) > 0;

        BigDecimal refunded = refundGatewayCaptureIfAny(order, reason);
        boolean gatewayRefunded = refunded.compareTo(BigDecimal.ZERO) > 0;
        if (gatewayRefunded) {
            order.setPaymentStatus(PaymentStatus.REFUNDED);
        } else if (order.getPaymentMethod() == PaymentMethod.COD
                && (order.getPaymentStatus() == PaymentStatus.PAID
                || order.getPaymentStatus() == PaymentStatus.PENDING
                || order.getPaymentStatus() == PaymentStatus.FAILED)) {
            // COD cash was never collected — keep PENDING (not "Paid" / not gateway "Failed").
            order.setPaymentStatus(PaymentStatus.PENDING);
        } else if (order.getPaymentMethod() == PaymentMethod.ONLINE
                && order.getPaymentStatus() == PaymentStatus.PAID
                && order.getTotalAmount() != null
                && order.getTotalAmount().compareTo(BigDecimal.ZERO) == 0) {
            // Fully wallet-covered ONLINE — nothing to refund at gateway.
            order.setPaymentStatus(PaymentStatus.REFUNDED);
        }

        // Empty cancelled order: no delivery fee left to collect.
        order.setDeliveryFee(BigDecimal.ZERO);
        order.setItemsSubtotal(BigDecimal.ZERO);
        order.setTotalAmount(BigDecimal.ZERO);

        return new UnwindResult(gatewayRefunded, refunded, creditRestored, restoredCredit);
    }

    public UnwindResult unwindCancelledOrder(Order order, String reason) {
        return unwindCancelledOrder(order, reason, null);
    }

    private void reversePriorItemCancelCredits(Order order, UUID skipItemId, String reason) {
        // COD never captured money at gateway — keep item cancel store credits on the wallet.
        // Reversing them would wipe the buyer's refund when the order empties.
        if (order.getPaymentMethod() == PaymentMethod.COD) {
            return;
        }
        if (order.getVendorSubOrders() == null) {
            return;
        }
        for (VendorSubOrder sub : order.getVendorSubOrders()) {
            if (sub.getItems() == null) {
                continue;
            }
            for (OrderItem item : sub.getItems()) {
                if (skipItemId != null && skipItemId.equals(item.getId())) {
                    continue;
                }
                if (item.getStatus() != OrderItemStatus.CANCELLED) {
                    continue;
                }
                BigDecimal credited = item.getStoreCreditAmount();
                if (credited == null || credited.compareTo(BigDecimal.ZERO) <= 0) {
                    continue;
                }
                try {
                    paymentClient.debitWallet(
                            order.getBuyerId(),
                            credited,
                            "ORDER_ITEM_CANCEL_REVERSAL",
                            UUID.randomUUID(),
                            order.getId(),
                            "Reverse item cancel credit before full order unwind: " + item.getItemNameSnapshot());
                } catch (BusinessException ex) {
                    throw new BusinessException(ErrorCode.CONFLICT,
                            "Cannot finish cancel — wallet no longer has the earlier item credit for "
                                    + item.getItemNameSnapshot() + ". Top up / free wallet space and retry.");
                } catch (RuntimeException ex) {
                    log.error("Failed reversing item cancel credit for item {}", item.getId(), ex);
                    throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                            "Could not reverse earlier item credits. Try again in a moment.");
                }
            }
        }
    }

    private void clearItemCancelCredits(Order order, UUID skipItemId) {
        if (order.getPaymentMethod() == PaymentMethod.COD) {
            return;
        }
        if (order.getVendorSubOrders() == null) {
            return;
        }
        for (VendorSubOrder sub : order.getVendorSubOrders()) {
            if (sub.getItems() == null) {
                continue;
            }
            for (OrderItem item : sub.getItems()) {
                if (skipItemId != null && skipItemId.equals(item.getId())) {
                    continue;
                }
                if (item.getStatus() == OrderItemStatus.CANCELLED) {
                    item.setStoreCreditAmount(null);
                }
            }
        }
    }

    private BigDecimal restoreCheckoutStoreCredit(Order order, String reason) {
        BigDecimal applied = order.getStoreCreditApplied();
        if (applied == null || applied.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        try {
            paymentClient.creditWallet(
                    order.getBuyerId(),
                    applied,
                    "ORDER_CANCEL_STORE_CREDIT",
                    order.getId(),
                    order.getId(),
                    null,
                    "Store credit restored after cancel: " + reason);
            order.setStoreCreditApplied(BigDecimal.ZERO);
            return applied;
        } catch (RuntimeException ex) {
            log.error("Failed to restore store credit {} for order {}", applied, order.getId(), ex);
            throw new BusinessException(ErrorCode.INTERNAL_ERROR,
                    "Could not restore wallet credit. Try again in a moment.");
        }
    }

    private BigDecimal refundGatewayCaptureIfAny(Order order, String reason) {
        if (order.getPaymentMethod() != PaymentMethod.ONLINE) {
            return BigDecimal.ZERO;
        }
        return paymentClient.refundSuccessfulPaymentIfAny(
                order.getId(), order.getBuyerId(), reason);
    }
}
