package com.hyperlocalmart.common.security;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM for field-level secrets at rest. Stored values are prefixed with {@link #PREFIX}.
 */
public final class SecretStringCrypto {

    public static final String PREFIX = "hlm1:";

    private static final int GCM_IV_BYTES = 12;
    private static final int GCM_TAG_BITS = 128;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final SecretKey key;

    public SecretStringCrypto(byte[] rawKey32) {
        if (rawKey32 == null || rawKey32.length != 32) {
            throw new IllegalArgumentException("Secrets encryption key must be 32 bytes");
        }
        this.key = new SecretKeySpec(rawKey32.clone(), "AES");
    }

    public static SecretStringCrypto fromConfig(String keyMaterial) {
        if (keyMaterial == null || keyMaterial.isBlank()) {
            throw new IllegalArgumentException("HLM_SECRETS_ENCRYPTION_KEY is not set");
        }
        String trimmed = keyMaterial.trim();
        byte[] decoded = tryBase64Key(trimmed);
        if (decoded != null) {
            return new SecretStringCrypto(decoded);
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return new SecretStringCrypto(digest.digest(trimmed.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("Could not derive secrets encryption key", e);
        }
    }

    public boolean isEncrypted(String stored) {
        return stored != null && stored.startsWith(PREFIX);
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isEmpty()) {
            return plaintext;
        }
        if (isEncrypted(plaintext)) {
            return plaintext;
        }
        try {
            byte[] iv = new byte[GCM_IV_BYTES];
            RANDOM.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            byte[] ciphertext = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            ByteBuffer packed = ByteBuffer.allocate(iv.length + ciphertext.length);
            packed.put(iv);
            packed.put(ciphertext);
            return PREFIX + Base64.getEncoder().encodeToString(packed.array());
        } catch (Exception e) {
            throw new IllegalStateException("Could not encrypt secret field", e);
        }
    }

    public String decrypt(String stored) {
        if (stored == null || stored.isEmpty()) {
            return stored;
        }
        if (!isEncrypted(stored)) {
            return stored;
        }
        try {
            byte[] packed = Base64.getDecoder().decode(stored.substring(PREFIX.length()));
            ByteBuffer buffer = ByteBuffer.wrap(packed);
            byte[] iv = new byte[GCM_IV_BYTES];
            buffer.get(iv);
            byte[] ciphertext = new byte[buffer.remaining()];
            buffer.get(ciphertext);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            return new String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Could not decrypt secret field — check HLM_SECRETS_ENCRYPTION_KEY", e);
        }
    }

    private static byte[] tryBase64Key(String value) {
        try {
            byte[] decoded = Base64.getDecoder().decode(value);
            if (decoded.length == 32) {
                return decoded;
            }
        } catch (IllegalArgumentException ignored) {
            // not base64 — fall through to SHA-256 derivation
        }
        return null;
    }
}
