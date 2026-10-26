package com.hyperlocalmart.common.event;

public final class KafkaTopics {

    public static final String PAYMENT_SUCCESS = "hyperlocalmart.payment.success";
    public static final String PAYMENT_FAILED = "hyperlocalmart.payment.failed";

    public static final String EVENT_PAYMENT_SUCCESS = "payment.success";
    public static final String EVENT_PAYMENT_FAILED = "payment.failed";

    private KafkaTopics() {
    }
}
