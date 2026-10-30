package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.Payment;
import com.hyperlocalmart.payment.entity.PaymentStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.math.BigDecimal;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PaymentRepository extends JpaRepository<Payment, UUID> {

    Optional<Payment> findByIdAndBuyerId(UUID id, UUID buyerId);

    Optional<Payment> findByIdempotencyKey(String idempotencyKey);

    Optional<Payment> findFirstByOrderIdAndStatusOrderByCreatedAtDesc(UUID orderId, PaymentStatus status);

    List<Payment> findByOrderIdOrderByCreatedAtDesc(UUID orderId);

    List<Payment> findByOrderIdIn(Collection<UUID> orderIds);

    @Query("""
            SELECT p.orderId, COALESCE(SUM(p.amount), 0)
            FROM Payment p
            WHERE p.orderId IN :orderIds
              AND p.status = com.hyperlocalmart.payment.entity.PaymentStatus.SUCCESS
            GROUP BY p.orderId
            """)
    List<Object[]> sumSuccessAmountsByOrderId(@Param("orderIds") Collection<UUID> orderIds);

    Optional<Payment> findByGatewayOrderId(String gatewayOrderId);

    Optional<Payment> findFirstByGatewayPaymentId(String gatewayPaymentId);

    List<Payment> findByStatusAndPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtAsc(
            PaymentStatus status, Instant start, Instant endExclusive);
}
