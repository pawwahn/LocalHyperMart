package com.hyperlocalmart.payment.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.event.EventEnvelope;
import com.hyperlocalmart.common.event.KafkaTopics;
import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.entity.PaymentGateway;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentEventPublisher {

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public UUID publishPaymentSuccess(Payment payment) {
        UUID eventId = UUID.randomUUID();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("paymentId", payment.getId().toString());
        payload.put("orderId", payment.getOrderId().toString());
        payload.put("buyerId", payment.getBuyerId().toString());
        payload.put("townId", payment.getTownId() != null ? payment.getTownId().toString() : null);
        payload.put("amount", payment.getAmount());
        payload.put("gateway", gatewayName(payment.getGateway()));
        payload.put("gatewayPaymentId", payment.getGatewayPaymentId());

        EventEnvelope envelope = EventEnvelope.builder()
                .eventId(eventId)
                .correlationId(payment.getOrderId())
                .eventType(KafkaTopics.EVENT_PAYMENT_SUCCESS)
                .sourceService("payment-service")
                .version("v1")
                .timestamp(Instant.now())
                .payload(payload)
                .build();
        send(KafkaTopics.PAYMENT_SUCCESS, payment.getOrderId().toString(), envelope);
        return eventId;
    }

    public UUID publishPaymentFailed(Payment payment, String reason) {
        UUID eventId = UUID.randomUUID();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("paymentId", payment.getId().toString());
        payload.put("orderId", payment.getOrderId().toString());
        payload.put("buyerId", payment.getBuyerId().toString());
        payload.put("failureReason", reason == null ? "FAILED" : reason);

        EventEnvelope envelope = EventEnvelope.builder()
                .eventId(eventId)
                .correlationId(payment.getOrderId())
                .eventType(KafkaTopics.EVENT_PAYMENT_FAILED)
                .sourceService("payment-service")
                .version("v1")
                .timestamp(Instant.now())
                .payload(payload)
                .build();
        send(KafkaTopics.PAYMENT_FAILED, payment.getOrderId().toString(), envelope);
        return eventId;
    }

    private void send(String topic, String key, EventEnvelope envelope) {
        try {
            String json = objectMapper.writeValueAsString(envelope);
            kafkaTemplate.send(topic, key, json).get();
        } catch (Exception ex) {
            log.warn("Kafka publish failed topic={} orderId={}", topic, key, ex);
            throw new IllegalStateException("Kafka publish failed for topic " + topic, ex);
        }
    }

    private static String gatewayName(PaymentGateway gateway) {
        return gateway == null ? PaymentGateway.RAZORPAY.name() : gateway.name();
    }
}
