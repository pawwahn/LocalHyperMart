package com.hyperlocalmart.order.beauty;

import java.math.BigDecimal;
import java.math.RoundingMode;

/** Glam checkout pass-through fees at booking time. */
public final class BeautyBookingFees {

    private BeautyBookingFees() {
    }

    /**
     * Town “pay-at-parlour extra” applies only when the buyer pays a minimum online and the
     * balance at the studio — not for home visits (partial prepay + pay at visit is still free of this surcharge).
     */
    public static BigDecimal parlourPaymentFee(BeautyVenue venue, boolean partialPrepay, BigDecimal townParlourFee) {
        if (venue != BeautyVenue.AT_STUDIO || !partialPrepay) {
            return zero();
        }
        return money(townParlourFee);
    }

    private static BigDecimal money(BigDecimal value) {
        if (value == null || value.signum() <= 0) {
            return zero();
        }
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal zero() {
        return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
    }
}
