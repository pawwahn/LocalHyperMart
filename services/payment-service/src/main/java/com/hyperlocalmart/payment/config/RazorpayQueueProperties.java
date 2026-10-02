package com.hyperlocalmart.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.payment.razorpay-queue")
public class RazorpayQueueProperties {

    /**
     * When true (and Razorpay keys are set), order/membership checkout creation runs on a bounded worker pool
     * instead of blocking the HTTP thread.
     */
    private boolean enabled = true;

    private int maxConcurrent = 8;

    private int queueCapacity = 512;
}
