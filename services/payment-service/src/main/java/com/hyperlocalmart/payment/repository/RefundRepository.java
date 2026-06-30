package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.Refund;
import com.hyperlocalmart.payment.entity.RefundStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface RefundRepository extends JpaRepository<Refund, UUID> {

    Optional<Refund> findFirstByOrderIdAndStatusInOrderByCreatedAtDesc(UUID orderId, Iterable<RefundStatus> statuses);
}
