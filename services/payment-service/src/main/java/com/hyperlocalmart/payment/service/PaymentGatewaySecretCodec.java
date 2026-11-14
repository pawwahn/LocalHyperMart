package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.security.SecretStringCrypto;

/**
 * Encrypts gateway credentials at rest when {@link SecretStringCrypto} is configured.
 */
public final class PaymentGatewaySecretCodec {

    private final SecretStringCrypto crypto;
    private final boolean encryptionEnabled;

    private PaymentGatewaySecretCodec(SecretStringCrypto crypto, boolean encryptionEnabled) {
        this.crypto = crypto;
        this.encryptionEnabled = encryptionEnabled;
    }

    public static PaymentGatewaySecretCodec withCrypto(SecretStringCrypto crypto) {
        return new PaymentGatewaySecretCodec(crypto, true);
    }

    public static PaymentGatewaySecretCodec plaintextOnly() {
        return new PaymentGatewaySecretCodec(null, false);
    }

    public boolean isEncryptionEnabled() {
        return encryptionEnabled;
    }

    public String encryptForStorage(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return trimToNull(plaintext);
        }
        if (!encryptionEnabled) {
            return plaintext.trim();
        }
        return crypto.encrypt(plaintext.trim());
    }

    public String decryptFromStorage(String stored) {
        if (stored == null || stored.isBlank()) {
            return "";
        }
        String trimmed = stored.trim();
        if (!encryptionEnabled) {
            if (trimmed.startsWith("hlm1:")) {
                throw new IllegalStateException(
                        "Gateway secret is encrypted. Set HLM_SECRETS_ENCRYPTION_KEY before starting payment-service.");
            }
            return trimmed;
        }
        return crypto.decrypt(trimmed).trim();
    }

    public String merge(String incomingPlain, String existingStored) {
        if (incomingPlain != null && !incomingPlain.isBlank()) {
            return encryptForStorage(incomingPlain);
        }
        return existingStored;
    }

    public boolean hasStoredSecret(String stored) {
        return stored != null && !stored.isBlank();
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
