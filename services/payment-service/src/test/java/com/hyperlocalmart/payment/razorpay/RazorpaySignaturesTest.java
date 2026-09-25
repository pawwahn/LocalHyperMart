package com.hyperlocalmart.payment.razorpay;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RazorpaySignaturesTest {

    @Test
    void hmacMatchesKnownPayload() {
        String hex = RazorpaySignatures.hmacSha256Hex("order_1|pay_1", "secret");
        assertThat(hex).hasSize(64);
        assertThat(RazorpaySignatures.hexEquals(hex, hex.toUpperCase())).isTrue();
        assertThat(RazorpaySignatures.verifyWebhook("{\"a\":1}", "nope", "secret")).isFalse();
        String webhookSig = RazorpaySignatures.hmacSha256Hex("{\"a\":1}", "whsec");
        assertThat(RazorpaySignatures.verifyWebhook("{\"a\":1}", webhookSig, "whsec")).isTrue();
    }
}
