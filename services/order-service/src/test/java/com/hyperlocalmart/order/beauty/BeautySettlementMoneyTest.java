package com.hyperlocalmart.order.beauty;

import com.hyperlocalmart.order.entity.BeautyOrder;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class BeautySettlementMoneyTest {

    @Test
    void fullGatewayUpi_koyaKartPaysVendor() {
        BeautyOrder order = baseCompleted()
                .prepayMode("FULL")
                .amountDueTotal(new BigDecimal("1100.00"))
                .amountCollected(new BigDecimal("1100.00"))
                .build();
        assertThat(BeautySettlementMoney.vendorHoldsVisitCash(order, new BigDecimal("1100.00"))).isFalse();
    }

    @Test
    void partialPrepayWithVisitBalance_shopHoldsCash() {
        BeautyOrder order = baseCompleted()
                .prepayMode("PARTIAL")
                .serviceAmount(new BigDecimal("699.00"))
                .travelCharge(new BigDecimal("50.00"))
                .platformFeeAmount(new BigDecimal("2.00"))
                .parlourPaymentFee(new BigDecimal("30.00"))
                .amountCollected(new BigDecimal("781.00"))
                .build();
        assertThat(BeautySettlementMoney.vendorHoldsVisitCash(order, new BigDecimal("50.00"))).isTrue();
    }

    private static BeautyOrder.BeautyOrderBuilder baseCompleted() {
        return BeautyOrder.builder()
                .id(UUID.randomUUID())
                .orderNumber("G-test")
                .townId(UUID.randomUUID())
                .vendorId(UUID.randomUUID())
                .artistName("A")
                .buyerId(UUID.randomUUID())
                .serviceType("HAIR")
                .status(BeautyOrderStatus.COMPLETED)
                .paymentMethod(BeautyPaymentMethod.UPI)
                .paymentStatus(BeautyPaymentStatus.COLLECTED)
                .placedAt(Instant.parse("2026-10-30T06:00:00Z"))
                .completedAt(Instant.parse("2026-10-30T08:00:00Z"))
                .slotStart(Instant.parse("2026-10-30T07:00:00Z"))
                .slotEnd(Instant.parse("2026-10-30T08:00:00Z"))
                .durationMinutes(60);
    }
}
