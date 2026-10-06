package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.ClaimStatus;
import com.hyperlocalmart.order.entity.OrderClaim;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderClaimRepository extends JpaRepository<OrderClaim, UUID> {

    List<OrderClaim> findByOrderIdOrderByCreatedAtDesc(UUID orderId);

    Page<OrderClaim> findByTownIdAndStatusOrderByCreatedAtDesc(UUID townId, ClaimStatus status, Pageable pageable);

    Page<OrderClaim> findByTownIdOrderByCreatedAtDesc(UUID townId, Pageable pageable);

    boolean existsByOrderIdAndOrderItemIdAndStatus(UUID orderId, UUID orderItemId, ClaimStatus status);

    boolean existsByOrderIdAndOrderItemIdIsNullAndStatus(UUID orderId, ClaimStatus status);

    Optional<OrderClaim> findByIdAndTownId(UUID id, UUID townId);

    @Query("""
            SELECT c FROM OrderClaim c
            WHERE c.createdAt >= :start AND c.createdAt < :end
              AND (:townId IS NULL OR c.townId = :townId)
            ORDER BY c.createdAt DESC
            """)
    List<OrderClaim> findInRange(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);
}
