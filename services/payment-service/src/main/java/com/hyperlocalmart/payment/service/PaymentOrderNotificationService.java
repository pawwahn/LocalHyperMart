package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.config.OrderNotifyProperties;
import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.event.PaymentEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentOrderNotificationService {

    private final OrderNotifyProperties orderNotifyProperties;
    private final PaymentEventPublisher paymentEventPublisher;
    private final OrderClient orderClient;

    public void notifyPaymentSuccess(Payment payment) {
        if (tryKafkaSuccess(payment)) {
            return;
        }
        orderClient.markPaymentSuccess(
                payment.getOrderId(),
                payment.getBuyerId(),
                payment.getId(),
                payment.getGateway(),
                payment.getAmount());
    }

    public void notifyPaymentFailed(Payment payment, String reason) {
        if (tryKafkaFailed(payment, reason)) {
            return;
        }
        orderClient.markPaymentFailed(payment.getOrderId(), payment.getBuyerId(), payment.getId(), reason);
    }

    private boolean tryKafkaSuccess(Payment payment) {
        if (!orderNotifyProperties.usesKafka()) {
            return false;
        }
        try {
            paymentEventPublisher.publishPaymentSuccess(payment);
            return true;
        } catch (RuntimeException ex) {
            if (orderNotifyProperties.getMode() == OrderNotifyProperties.Mode.KAFKA) {
                throw ex;
            }
            log.warn("Kafka notify failed for paymentId={}, falling back to HTTP", payment.getId(), ex);
            return false;
        }
    }

    private boolean tryKafkaFailed(Payment payment, String reason) {
        if (!orderNotifyProperties.usesKafka()) {
            return false;
        }
        try {
            paymentEventPublisher.publishPaymentFailed(payment, reason);
            return true;
        } catch (RuntimeException ex) {
            if (orderNotifyProperties.getMode() == OrderNotifyProperties.Mode.KAFKA) {
                throw ex;
            }
            log.warn("Kafka failed notify for paymentId={}, falling back to HTTP", payment.getId(), ex);
            return false;
        }
    }
}
