package com.hyperlocalmart.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.payment.admission")
public class PaymentAdmissionProperties {

    /**
     * When true, new payment/membership-online initiates share a platform-wide per-second cap (Redis when available).
     */
    private boolean enabled = false;

    /** Maximum new checkout initiations allowed per UTC second (cluster-wide with Redis). */
    private int maxPerSecond = 50;

    /** How long a caller may wait in the admission queue before failing with {@code RATE_LIMITED}. */
    private long maxWaitMs = 30_000L;

    /** Sleep between admission retries while waiting for a slot. */
    private long retryIntervalMs = 25L;

    /** When Redis errors, allow traffic (true) or reject (false). */
    private boolean failOpenOnRedisError = true;

    private String redisKeyPrefix = "hlm:payment:admit";
}
