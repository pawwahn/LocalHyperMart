package com.hyperlocalmart.order.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.order")
public class OrderEventProperties {

    /**
     * When true, order-service consumes hyperlocalmart.payment.* from Kafka.
     * Keep false until payment-service order-notify mode uses Kafka.
     */
    private boolean paymentEventsConsumerEnabled = false;
}
