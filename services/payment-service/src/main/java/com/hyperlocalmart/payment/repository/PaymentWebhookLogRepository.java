package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.PaymentWebhookLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface PaymentWebhookLogRepository extends JpaRepository<PaymentWebhookLog, UUID> {

    List<PaymentWebhookLog> findTop50BySignatureValidTrueAndProcessedFalseAndReceivedAtBeforeOrderByReceivedAtAsc(
            Instant receivedAtBefore);
}
