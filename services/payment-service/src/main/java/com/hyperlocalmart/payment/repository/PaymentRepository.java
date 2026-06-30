package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findByIdAndBuyerId(UUID id, UUID buyerId);

    Optional<Payment> findByIdempotencyKey(String idempotencyKey);

    Optional<Payment> findFirstByOrderIdAndStatusOrderByCreatedAtDesc(UUID orderId, PaymentStatus status);

    List<Payment> findByOrderIdOrderByCreatedAtDesc(UUID orderId);
}
