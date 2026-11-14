package com.hyperlocalmart.common.security;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;

class SecretStringCryptoTest {

    @Test
    void roundTripWithBase64Key() {
        byte[] raw = new byte[32];
        for (int i = 0; i < raw.length; i++) {
            raw[i] = (byte) i;
        }
        SecretStringCrypto crypto = new SecretStringCrypto(raw);
        String enc = crypto.encrypt("razorpay_live_secret");
        assertThat(enc).startsWith(SecretStringCrypto.PREFIX);
        assertThat(crypto.decrypt(enc)).isEqualTo("razorpay_live_secret");
        assertThat(crypto.decrypt("plain-legacy")).isEqualTo("plain-legacy");
    }

    @Test
    void fromConfigAcceptsBase64EnvStyle() {
        byte[] raw = new byte[32];
        raw[0] = 7;
        String b64 = Base64.getEncoder().encodeToString(raw);
        SecretStringCrypto crypto = SecretStringCrypto.fromConfig(b64);
        assertThat(crypto.encrypt("x")).startsWith(SecretStringCrypto.PREFIX);
    }
}
