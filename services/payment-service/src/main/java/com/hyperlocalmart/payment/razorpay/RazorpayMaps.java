package com.hyperlocalmart.payment.razorpay;

import java.util.Map;

public final class RazorpayMaps {

    private RazorpayMaps() {
    }

    public static String nestedString(Map<String, Object> root, String... path) {
        Object current = root;
        for (String key : path) {
            if (!(current instanceof Map<?, ?> map)) {
                return null;
            }
            current = map.get(key);
        }
        return current == null ? null : String.valueOf(current);
    }
}
