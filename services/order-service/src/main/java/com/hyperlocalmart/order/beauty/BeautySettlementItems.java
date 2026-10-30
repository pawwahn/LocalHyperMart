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
 * prorated by COD vs UPI, partial prepay, or goods split. Hybrid bookings bill them once on the
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
        BigDecimal online = onlinePayments.sumSuccessfulPaymentsForOrder(order.getId());
        if (online == null) {
            online = money(order.getAmountCollected());
        }
        BigDecimal total = BeautySettlementMoney.orderTotal(order);
        boolean visitCash = BeautySettlementMoney.vendorHoldsVisitCash(order, online);
        if (visitCash && online.signum() > 0 && online.compareTo(total) < 0) {
            List<SettlementCandidateResponse.Item> out = new ArrayList<>(2);
            out.add(onlineSlice(order, online, total));
            out.add(visitSlice(order, online, total));
            return out;
        }
        return List.of(single(order, visitCash));
    }

    private static SettlementCandidateResponse.Item single(BeautyOrder order, boolean shopCash) {
        boolean online = order.getPaymentMethod() == BeautyPaymentMethod.UPI && !shopCash;
        Instant when = completedAt(order);
        BigDecimal goods = goodsSubtotal(order);
        return base(order, order.getId(), order.getOrderNumber(), when)
                .paymentMethod(online ? PaymentMethod.ONLINE : PaymentMethod.COD)
                .vendorAgentDelivery(shopCash)
                .subtotal(goods)
                .platformFee(shopCash ? flatPlatformFee(order) : zero())
                .codFee(shopCash ? flatCodFee(order) : zero())
                .parlourPaymentFee(shopCash ? flatParlourFee(order) : zero())
                .build();
    }

    private static SettlementCandidateResponse.Item onlineSlice(
            BeautyOrder order, BigDecimal onlinePaid, BigDecimal total) {
        BigDecimal goods = goodsSubtotal(order);
        BigDecimal goodsOnline = goods.multiply(onlinePaid).divide(total, 2, RoundingMode.HALF_UP);
        if (goodsOnline.compareTo(goods) > 0) {
            goodsOnline = goods;
        }
        UUID sliceId = onlineSliceId(order.getId());
        String label = order.getOrderNumber() + " (UPI with KoyaKart)";
        return base(order, sliceId, label, completedAt(order))
                .paymentMethod(PaymentMethod.ONLINE)
                .vendorAgentDelivery(false)
                .subtotal(goodsOnline)
                .platformFee(zero())
                .codFee(zero())
                .parlourPaymentFee(zero())
                .onlineRemittanceAmount(money(onlinePaid))
                .build();
    }

    private static SettlementCandidateResponse.Item visitSlice(
            BeautyOrder order, BigDecimal onlinePaid, BigDecimal total) {
        BigDecimal goods = goodsSubtotal(order);
        BigDecimal goodsOnline = goods.multiply(onlinePaid).divide(total, 2, RoundingMode.HALF_UP);
        BigDecimal goodsVisit = goods.subtract(goodsOnline).max(zero());
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
