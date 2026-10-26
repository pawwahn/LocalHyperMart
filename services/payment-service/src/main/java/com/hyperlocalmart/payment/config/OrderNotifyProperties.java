package com.hyperlocalmart.payment.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "hyperlocalmart.payment.order-notify")
public class OrderNotifyProperties {

    public enum Mode {
        /** HTTP to order-service (default, current behaviour). */
        SYNC,
        /** Publish Kafka event; on publish failure fall back to HTTP. */
        KAFKA_WITH_SYNC_FALLBACK,
        /** Publish only — requires order-service Kafka consumer enabled. */
        KAFKA
    }

    private Mode mode = Mode.SYNC;

    public boolean usesKafka() {
        return mode == Mode.KAFKA || mode == Mode.KAFKA_WITH_SYNC_FALLBACK;
    }

    public boolean syncFallbackOnKafkaFailure() {
        return mode == Mode.KAFKA_WITH_SYNC_FALLBACK;
    }
}
