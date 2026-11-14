package com.hyperlocalmart.order.diagnostics;

import com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus;
import com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod;
import com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus;
import com.hyperlocalmart.order.entity.DiagnosticsOrder;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class DiagnosticsSettlementMoneyTest {

    @Test
    void goodsSubtotal_isTestsPlusHomeCollection() {
        DiagnosticsOrder order = DiagnosticsOrder.builder()
                .testsSubtotal(new BigDecimal("800.00"))
                .homeCollectionFee(new BigDecimal("150.00"))
                .build();
        assertThat(DiagnosticsSettlementMoney.goodsSubtotal(order)).isEqualByComparingTo("950.00");
    }

    @Test
    void upiPlatformAndCodFeesAreZeroOnSettlementItem() {
        DiagnosticsOrder order = DiagnosticsOrder.builder()
                .paymentMethod(DiagnosticsPaymentMethod.UPI)
                .platformFeeAmount(new BigDecimal("25.00"))
                .codFee(new BigDecimal("10.00"))
                .build();
        assertThat(DiagnosticsSettlementMoney.buyerPlatformFeeForSettlement(order)).isEqualByComparingTo("0.00");
        assertThat(DiagnosticsSettlementMoney.buyerCodFeeForSettlement(order)).isEqualByComparingTo("0.00");
    }

    @Test
    void receivedAtLabIsBillableForSettlement() {
        assertThat(DiagnosticsSettlementMoney.billable(DiagnosticsOrderStatus.RECEIVED_AT_LAB)).isTrue();
        assertThat(DiagnosticsSettlementMoney.billable(DiagnosticsOrderStatus.REPORT_FINALIZED)).isTrue();
        assertThat(DiagnosticsSettlementMoney.billable(DiagnosticsOrderStatus.BOOKED)).isFalse();
    }

    @Test
    void upiPaidAtLabIsSettlementEligible() {
        DiagnosticsOrder order = DiagnosticsOrder.builder()
                .status(DiagnosticsOrderStatus.RECEIVED_AT_LAB)
                .paymentMethod(DiagnosticsPaymentMethod.UPI)
                .paymentStatus(DiagnosticsPaymentStatus.PAID)
                .build();
        assertThat(DiagnosticsSettlementMoney.settlementEligible(order)).isTrue();
    }

    @Test
    void codBillsPlatformAndCodSurchargeToLab() {
        DiagnosticsOrder order = DiagnosticsOrder.builder()
                .paymentMethod(DiagnosticsPaymentMethod.COD)
                .platformFeeAmount(new BigDecimal("25.00"))
                .codFee(new BigDecimal("10.00"))
                .build();
        assertThat(DiagnosticsSettlementMoney.buyerPlatformFeeForSettlement(order)).isEqualByComparingTo("25.00");
        assertThat(DiagnosticsSettlementMoney.buyerCodFeeForSettlement(order)).isEqualByComparingTo("10.00");
    }
}
