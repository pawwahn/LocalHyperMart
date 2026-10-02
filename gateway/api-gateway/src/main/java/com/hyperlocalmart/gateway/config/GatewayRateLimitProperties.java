package com.hyperlocalmart.gateway.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "hyperlocalmart.gateway.rate-limit")
public class GatewayRateLimitProperties {

    /** When false, no Redis rate limiter is registered (gateway runs without Redis). */
    private boolean enabled = false;

    /** Steady-state tokens per second per client key (user id or IP). */
    private int replenishRate = 30;

    /** Short burst capacity per client key. */
    private int burstCapacity = 60;

    private int requestedTokens = 1;
}
