package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.DeliveryAgentRating;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface DeliveryAgentRatingRepository extends JpaRepository<DeliveryAgentRating, UUID> {

    Optional<DeliveryAgentRating> findByOrderId(UUID orderId);

    Page<DeliveryAgentRating> findByAgentIdOrderByCreatedAtDesc(UUID agentId, Pageable pageable);

    Page<DeliveryAgentRating> findByAgentIdAndTownIdOrderByCreatedAtDesc(
            UUID agentId, UUID townId, Pageable pageable);

    long countByAgentId(UUID agentId);

    long countByAgentIdAndTownId(UUID agentId, UUID townId);

    @Query("SELECT AVG(r.stars) FROM DeliveryAgentRating r WHERE r.agentId = :agentId")
    Double averageStarsByAgentId(@Param("agentId") UUID agentId);

    @Query("""
            SELECT AVG(r.stars) FROM DeliveryAgentRating r
            WHERE r.agentId = :agentId AND r.townId = :townId
            """)
    Double averageStarsByAgentIdAndTownId(@Param("agentId") UUID agentId, @Param("townId") UUID townId);
}
