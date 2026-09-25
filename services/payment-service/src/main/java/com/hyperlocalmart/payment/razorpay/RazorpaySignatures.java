package com.hyperlocalmart.payment.razorpay;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.Locale;

public final class RazorpaySignatures {

    private RazorpaySignatures() {
    }

    public static String hmacSha256Hex(String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException("Could not compute Razorpay signature", ex);
        }
    }

    public static boolean hexEquals(String expected, String actual) {
        if (expected == null || actual == null) {
            return false;
        }
        byte[] left = expected.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
        byte[] right = actual.toLowerCase(Locale.ROOT).getBytes(StandardCharsets.UTF_8);
        return left.length == right.length && MessageDigest.isEqual(left, right);
    }

    public static void verifyPayment(String razorpayOrderId, String razorpayPaymentId, String signature, String keySecret) {
        if (keySecret == null || keySecret.isBlank()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Razorpay is not configured");
        }
        if (razorpayOrderId == null || razorpayPaymentId == null || signature == null) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Missing Razorpay payment signature");
        }
        String expected = hmacSha256Hex(razorpayOrderId + "|" + razorpayPaymentId, keySecret);
        if (!hexEquals(expected, signature)) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid Razorpay payment signature");
        }
    }

    public static boolean verifyWebhook(String rawBody, String signature, String webhookSecret) {
        if (webhookSecret == null || webhookSecret.isBlank() || rawBody == null || signature == null) {
            return false;
        }
        return hexEquals(hmacSha256Hex(rawBody, webhookSecret), signature);
    }
}
