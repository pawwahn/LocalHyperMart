package com.hyperlocalmart.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.payment.webhook-queue")
public class WebhookQueueProperties {

    /**
     * When true, valid webhooks are acknowledged after enqueue; workers apply payment updates.
     * Invalid signatures still fail the HTTP request (same as sync mode).
     */
    private boolean enabled = false;

    private int maxConcurrent = 16;

    private int queueCapacity = 1024;
}
