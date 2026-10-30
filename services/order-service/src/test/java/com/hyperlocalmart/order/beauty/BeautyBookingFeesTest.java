package com.hyperlocalmart.order.beauty;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class BeautyBookingFeesTest {

    @Test
    void parlourFee_onlyForStudioPartialPrepay() {
        BigDecimal town = new BigDecimal("30.00");
        assertThat(BeautyBookingFees.parlourPaymentFee(BeautyVenue.AT_STUDIO, true, town))
                .isEqualByComparingTo("30.00");
        assertThat(BeautyBookingFees.parlourPaymentFee(BeautyVenue.AT_HOME, true, town))
                .isEqualByComparingTo("0.00");
        assertThat(BeautyBookingFees.parlourPaymentFee(BeautyVenue.AT_STUDIO, false, town))
                .isEqualByComparingTo("0.00");
    }
}
