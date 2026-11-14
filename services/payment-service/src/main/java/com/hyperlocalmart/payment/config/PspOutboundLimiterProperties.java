package com.hyperlocalmart.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.payment.psp-outbound")
public class PspOutboundLimiterProperties {

    /**
     * Limits concurrent outbound PSP API calls (Razorpay / Cashfree / PhonePe order create) per payment-service instance.
     */
    private boolean enabled = true;

    private int maxConcurrent = 50;

    /** Max time to wait for a PSP slot (checkout polling relies on gateway session creation). */
    private long maxWaitMs = 45_000L;
}
