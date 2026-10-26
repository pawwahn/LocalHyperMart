package com.hyperlocalmart.order.event;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.event.EventEnvelope;
import com.hyperlocalmart.common.event.KafkaTopics;
import com.hyperlocalmart.order.config.OrderEventProperties;
import com.hyperlocalmart.order.dto.request.PaymentCallbackRequest;
import com.hyperlocalmart.order.entity.ProcessedEvent;
import com.hyperlocalmart.order.repository.ProcessedEventRepository;
import com.hyperlocalmart.order.service.OrderService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "hyperlocalmart.order", name = "payment-events-consumer-enabled", havingValue = "true")
public class PaymentEventConsumer {

    private final ObjectMapper objectMapper;
    private final ProcessedEventRepository processedEventRepository;
    private final OrderService orderService;

    @KafkaListener(
            topics = KafkaTopics.PAYMENT_SUCCESS,
            groupId = "order-service-group",
            containerFactory = "kafkaListenerContainerFactory")
    @Transactional
    public void onPaymentSuccess(String message) {
        EventEnvelope envelope = parse(message);
        if (envelope.getEventId() != null && processedEventRepository.existsByEventId(envelope.getEventId())) {
            return;
        }
        Map<String, Object> payload = envelope.getPayload();
        if (payload == null) {
            log.warn("payment.success missing payload eventId={}", envelope.getEventId());
            return;
        }
        UUID orderId = uuid(payload.get("orderId"));
        UUID buyerId = uuid(payload.get("buyerId"));
        UUID paymentId = uuid(payload.get("paymentId"));
        if (orderId == null || buyerId == null || paymentId == null) {
            log.warn("payment.success missing ids eventId={}", envelope.getEventId());
            return;
        }
        PaymentCallbackRequest request = new PaymentCallbackRequest();
        request.setBuyerId(buyerId);
        request.setPaymentId(paymentId);
        Object gateway = payload.get("gateway");
        if (gateway != null) {
            request.setGateway(String.valueOf(gateway));
        }
        Object amount = payload.get("amount");
        if (amount instanceof Number number) {
            request.setAmount(java.math.BigDecimal.valueOf(number.doubleValue()).setScale(2, java.math.RoundingMode.HALF_UP));
        } else if (amount != null && !String.valueOf(amount).isBlank()) {
            request.setAmount(new java.math.BigDecimal(String.valueOf(amount)).setScale(2, java.math.RoundingMode.HALF_UP));
        }
        orderService.markPaymentSuccess(orderId, request);
        if (envelope.getEventId() != null) {
            processedEventRepository.save(ProcessedEvent.builder().eventId(envelope.getEventId()).build());
        }
    }

    @KafkaListener(
            topics = KafkaTopics.PAYMENT_FAILED,
            groupId = "order-service-group",
            containerFactory = "kafkaListenerContainerFactory")
    @Transactional
    public void onPaymentFailed(String message) {
        EventEnvelope envelope = parse(message);
        if (envelope.getEventId() != null && processedEventRepository.existsByEventId(envelope.getEventId())) {
            return;
        }
        Map<String, Object> payload = envelope.getPayload();
        if (payload == null) {
            return;
        }
        UUID orderId = uuid(payload.get("orderId"));
        UUID buyerId = uuid(payload.get("buyerId"));
        UUID paymentId = uuid(payload.get("paymentId"));
        if (orderId == null || buyerId == null || paymentId == null) {
            return;
        }
        PaymentCallbackRequest request = new PaymentCallbackRequest();
        request.setBuyerId(buyerId);
        request.setPaymentId(paymentId);
        Object reason = payload.get("failureReason");
        request.setReason(reason == null ? "FAILED" : String.valueOf(reason));
        orderService.markPaymentFailed(orderId, request);
        if (envelope.getEventId() != null) {
            processedEventRepository.save(ProcessedEvent.builder().eventId(envelope.getEventId()).build());
        }
    }

    private EventEnvelope parse(String message) {
        try {
            return objectMapper.readValue(message, EventEnvelope.class);
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid event JSON", ex);
        }
    }

    private static UUID uuid(Object raw) {
        if (raw == null) {
            return null;
        }
        try {
            return UUID.fromString(String.valueOf(raw));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
