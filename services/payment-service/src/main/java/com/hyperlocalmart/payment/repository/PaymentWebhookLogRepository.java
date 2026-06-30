package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.PaymentWebhookLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface PaymentWebhookLogRepository extends JpaRepository<PaymentWebhookLog, UUID> {
}
