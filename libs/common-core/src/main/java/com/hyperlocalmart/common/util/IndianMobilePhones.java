package com.hyperlocalmart.common.util;

/**
 * Cashfree and other UPI gateways require a 10-digit Indian mobile on the customer.
 */
public final class IndianMobilePhones {

    private IndianMobilePhones() {
    }

    public static String tenDigit(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String digits = raw.replaceAll("\\D", "");
        if (digits.length() > 10) {
            digits = digits.substring(digits.length() - 10);
        }
        return digits.length() == 10 ? digits : null;
    }

    public static String firstTenDigit(String... candidates) {
        if (candidates == null) {
            return null;
        }
        for (String raw : candidates) {
            String digits = tenDigit(raw);
            if (digits != null) {
                return digits;
            }
        }
        return null;
    }
}
