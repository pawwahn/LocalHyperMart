package com.hyperlocalmart.payment.cashfree;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

public final class CashfreeSignatures {

    private CashfreeSignatures() {
    }

    public static boolean verifyWebhook(String rawBody, String timestamp, String signature, String secret) {
        if (rawBody == null || timestamp == null || timestamp.isBlank() || signature == null || signature.isBlank()
                || secret == null || secret.isBlank()) {
            return false;
        }
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = mac.doFinal((timestamp + rawBody).getBytes(StandardCharsets.UTF_8));
            byte[] expected = Base64.getEncoder().encode(digest);
            return MessageDigest.isEqual(expected, signature.trim().getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            return false;
        }
    }
}
