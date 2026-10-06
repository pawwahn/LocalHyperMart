package com.hyperlocalmart.user.repository;

import com.hyperlocalmart.user.entity.ReferralAttribution;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReferralAttributionRepository extends JpaRepository<ReferralAttribution, UUID> {

    Optional<ReferralAttribution> findByRefereeUserId(UUID refereeUserId);

    boolean existsByRefereeUserId(UUID refereeUserId);

    @Query("""
            SELECT r FROM ReferralAttribution r
            WHERE r.createdAt >= :start AND r.createdAt < :end
            ORDER BY r.createdAt DESC
            """)
    List<ReferralAttribution> findCreatedBetween(@Param("start") Instant start, @Param("end") Instant end);
}
