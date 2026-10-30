package com.hyperlocalmart.order.beauty;

import com.hyperlocalmart.order.dto.response.SettlementCandidateResponse;
import com.hyperlocalmart.order.entity.BeautyOrder;
import com.hyperlocalmart.order.entity.PaymentMethod;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BeautySettlementItemsTest {

    @Test
    void partialPrepay_splitsOnlinePayAndVisitCollect() {
        UUID orderId = UUID.randomUUID();
        BeautyOrder order = BeautyOrder.builder()
                .id(orderId)
                .orderNumber("G261026-0001")
                .townId(UUID.randomUUID())
                .vendorId(UUID.randomUUID())
                .artistName("Test")
                .buyerId(UUID.randomUUID())
                .serviceType("HAIR")
                .status(BeautyOrderStatus.COMPLETED)
                .paymentMethod(BeautyPaymentMethod.UPI)
                .paymentStatus(BeautyPaymentStatus.COLLECTED)
                .serviceAmount(new BigDecimal("699.00"))
                .travelCharge(new BigDecimal("50.00"))
                .platformFeeAmount(new BigDecimal("2.00"))
                .venue(BeautyVenue.AT_STUDIO)
                .parlourPaymentFee(new BigDecimal("30.00"))
                .amountDueTotal(new BigDecimal("781.00"))
                .amountCollected(new BigDecimal("781.00"))
                .prepayMode("PARTIAL")
                .placedAt(Instant.parse("2026-10-25T19:07:09Z"))
                .completedAt(Instant.parse("2026-10-30T16:32:53Z"))
                .slotEnd(Instant.parse("2026-10-30T16:32:53Z"))
                .durationMinutes(60)
                .build();

        var items = BeautySettlementItems.toItems(order, id -> new BigDecimal("50.00"));

        assertThat(items).hasSize(2);
        SettlementCandidateResponse.Item pay = items.stream()
                .filter(i -> i.getPaymentMethod() == PaymentMethod.ONLINE)
                .findFirst()
                .orElseThrow();
        SettlementCandidateResponse.Item visit = items.stream()
                .filter(i -> i.getPaymentMethod() == PaymentMethod.COD)
                .findFirst()
                .orElseThrow();
        assertThat(pay.getSubOrderId()).isEqualTo(BeautySettlementItems.onlineSliceId(orderId));
        assertThat(pay.isVendorAgentDelivery()).isFalse();
        assertThat(visit.isVendorAgentDelivery()).isTrue();
        assertThat(pay.getSubtotal().add(visit.getSubtotal())).isEqualByComparingTo("749.00");
        assertThat(visit.getPlatformFee()).isEqualByComparingTo("2.00");
        assertThat(visit.getParlourPaymentFee()).isEqualByComparingTo("30.00");
        assertThat(pay.getPlatformFee()).isEqualByComparingTo("0.00");
    }
}
