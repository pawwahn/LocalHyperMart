package com.hyperlocalmart.payment.phonepe;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public final class PhonePeSignatures {

    private PhonePeSignatures() {
    }

    public static boolean verifyWebhook(String authorization, String username, String password) {
        if (authorization == null || authorization.isBlank() || username == null || username.isBlank()
                || password == null || password.isBlank()) {
            return false;
        }
        String expected = sha256Hex(username.trim() + ":" + password);
        String given = authorization.trim();
        if (given.regionMatches(true, 0, "SHA256 ", 0, 7)) {
            given = given.substring(7).trim();
        }
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), given.getBytes(StandardCharsets.UTF_8));
    }

    static String sha256Hex(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                out.append(Character.forDigit((b >> 4) & 0xF, 16));
                out.append(Character.forDigit(b & 0xF, 16));
            }
            return out.toString();
        } catch (Exception ex) {
            return "";
        }
    }
}
