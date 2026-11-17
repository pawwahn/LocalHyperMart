package com.hyperlocalmart.order.beauty;

import com.hyperlocalmart.order.client.SuccessfulOnlineTotalLookup;
import com.hyperlocalmart.order.dto.response.SettlementCandidateResponse;
import com.hyperlocalmart.order.entity.BeautyOrder;
import com.hyperlocalmart.order.entity.PaymentMethod;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Maps completed glam bookings to settlement candidate rows (incl. hybrid online + visit).
 * <p>Town platform fee (and other flat checkout pass-throughs) are fixed at booking — never
 * split across payment channels. Hybrid bookings bill them once on the
 * shop-held visit slice; the KoyaKart UPI slice carries zero pass-through on the settlement line.
 */
public final class BeautySettlementItems {

    private BeautySettlementItems() {
    }

    /** Stable id for the KoyaKart-held UPI slice (distinct from visit-cash settlement). */
    public static UUID onlineSliceId(UUID orderId) {
        return UUID.nameUUIDFromBytes(("beauty-online:" + orderId).getBytes(StandardCharsets.UTF_8));
    }

    public static List<SettlementCandidateResponse.Item> toItems(
            BeautyOrder order, SuccessfulOnlineTotalLookup onlinePayments) {
        BigDecimal total = BeautySettlementMoney.orderTotal(order);
        BigDecimal online = resolveOnlinePaid(order, onlinePayments, total);
        boolean visitCash = BeautySettlementMoney.vendorHoldsVisitCash(order, online);
        if (visitCash && online.signum() > 0 && online.compareTo(total) < 0) {
            List<SettlementCandidateResponse.Item> out = new ArrayList<>(2);
            out.add(onlineSlice(order, online));
            out.add(visitSlice(order, online));
            return out;
        }
        return List.of(single(order, visitCash, online));
    }

    /**
     * Sum of SUCCESS UPI held by KoyaKart for this booking. When payment-service returns zero
     * (lagging webhook or missing row) but the glam ledger shows prepay received, fall back to
     * {@code prepayAmount} / collected so Accounts still gets the online slice and amounts.
     */
    static BigDecimal resolveOnlinePaid(
            BeautyOrder order, SuccessfulOnlineTotalLookup onlinePayments, BigDecimal orderTotal) {
        BigDecimal fromPayments = onlinePayments.sumSuccessfulPaymentsForOrder(order.getId());
        if (fromPayments == null) {
            fromPayments = zero();
        }
        if (fromPayments.signum() > 0) {
            return fromPayments;
        }
        if (order.getPaymentMethod() != BeautyPaymentMethod.UPI) {
            return fromPayments;
        }
        if (order.getPaymentStatus() == BeautyPaymentStatus.DUE
                || order.getPaymentStatus() == BeautyPaymentStatus.FAILED) {
            return fromPayments;
        }
        BigDecimal total = orderTotal != null ? money(orderTotal) : BeautySettlementMoney.orderTotal(order);
        if (partialPrepay(order)) {
            BigDecimal prepay = money(order.getPrepayAmount());
            if (prepay.signum() > 0) {
                return prepay.min(total);
            }
        }
        BigDecimal collected = money(order.getAmountCollected());
        if (collected.signum() > 0 && collected.compareTo(total) < 0) {
            return collected;
        }
        if (!partialPrepay(order) && collected.compareTo(total) >= 0) {
            return total;
        }
        return fromPayments;
    }

    private static boolean partialPrepay(BeautyOrder order) {
        String mode = order.getPrepayMode();
        return mode != null && "PARTIAL".equalsIgnoreCase(mode.trim());
    }

    private static SettlementCandidateResponse.Item single(BeautyOrder order, boolean shopCash, BigDecimal onlineHeld) {
        boolean online = order.getPaymentMethod() == BeautyPaymentMethod.UPI && !shopCash;
        Instant when = completedAt(order);
        BigDecimal goods = goodsSubtotal(order);
        // Hybrid UPI slices keep pass-through on the visit row only; full UPI or shop-held need fees on this row.
        boolean passThroughOnRow = shopCash || (online && onlineHeld.signum() > 0);
        var builder = base(order, order.getId(), order.getOrderNumber(), when)
                .paymentMethod(online ? PaymentMethod.ONLINE : PaymentMethod.COD)
                .vendorAgentDelivery(shopCash)
                .subtotal(goods)
                .platformFee(passThroughOnRow ? flatPlatformFee(order) : zero())
                .codFee(passThroughOnRow ? flatCodFee(order) : zero())
                .parlourPaymentFee(passThroughOnRow ? flatParlourFee(order) : zero());
        if (online && onlineHeld.signum() > 0) {
            builder.onlineRemittanceAmount(money(onlineHeld));
        }
        return builder.build();
    }

    private static SettlementCandidateResponse.Item onlineSlice(BeautyOrder order, BigDecimal onlinePaid) {
        BigDecimal upiGoods = money(onlinePaid);
        UUID sliceId = onlineSliceId(order.getId());
        String label = order.getOrderNumber() + " (UPI with KoyaKart)";
        return base(order, sliceId, label, completedAt(order))
                .paymentMethod(PaymentMethod.ONLINE)
                .vendorAgentDelivery(false)
                .subtotal(upiGoods)
                .platformFee(zero())
                .codFee(zero())
                .parlourPaymentFee(zero())
                .onlineRemittanceAmount(upiGoods)
                .build();
    }

    private static SettlementCandidateResponse.Item visitSlice(BeautyOrder order, BigDecimal onlinePaid) {
        BigDecimal goods = goodsSubtotal(order);
        BigDecimal goodsVisit = goods.subtract(money(onlinePaid)).max(zero());
        return base(order, order.getId(), order.getOrderNumber(), completedAt(order))
                .paymentMethod(PaymentMethod.COD)
                .vendorAgentDelivery(true)
                .subtotal(goodsVisit)
                .platformFee(flatPlatformFee(order))
                .codFee(flatCodFee(order))
                .parlourPaymentFee(flatParlourFee(order))
                .build();
    }

    private static SettlementCandidateResponse.Item.ItemBuilder base(
            BeautyOrder order, UUID subOrderId, String orderNumber, Instant when) {
        return SettlementCandidateResponse.Item.builder()
                .subOrderId(subOrderId)
                .orderId(order.getId())
                .orderNumber(orderNumber)
                .subOrderNumber(orderNumber)
                .placedAt(order.getPlacedAt())
                .deliveredAt(when)
                .status(VendorSubOrderStatus.DELIVERED)
                .paymentStatus(beautyPayment(order.getPaymentStatus()))
                .membershipFee(zero());
    }

    private static Instant completedAt(BeautyOrder order) {
        if (order.getCompletedAt() != null) {
            return order.getCompletedAt();
        }
        if (order.getSlotEnd() != null) {
            return order.getSlotEnd();
        }
        return order.getPlacedAt();
    }

    private static BigDecimal goodsSubtotal(BeautyOrder order) {
        return money(order.getServiceAmount()).add(money(order.getTravelCharge()));
    }

    private static BigDecimal flatPlatformFee(BeautyOrder order) {
        return money(order.getPlatformFeeAmount());
    }

    private static BigDecimal flatCodFee(BeautyOrder order) {
        return money(order.getCodFee());
    }

    private static BigDecimal flatParlourFee(BeautyOrder order) {
        return money(order.getParlourPaymentFee());
    }

    private static PaymentStatus beautyPayment(BeautyPaymentStatus status) {
        if (status == BeautyPaymentStatus.COLLECTED) {
            return PaymentStatus.PAID;
        }
        if (status == BeautyPaymentStatus.FAILED) {
            return PaymentStatus.FAILED;
        }
        return PaymentStatus.PENDING;
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null) {
            return zero();
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
