package com.hyperlocalmart.payment.razorpay;

import java.math.BigDecimal;
import java.math.RoundingMode;

public final class RazorpayMoney {

    private RazorpayMoney() {
    }

    public static long toPaise(BigDecimal rupees) {
        if (rupees == null) {
            return 0L;
        }
        return rupees.movePointRight(2).setScale(0, RoundingMode.HALF_UP).longValueExact();
    }
}
