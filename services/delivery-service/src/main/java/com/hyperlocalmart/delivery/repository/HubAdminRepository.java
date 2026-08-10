package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.HubAdmin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubAdminRepository extends JpaRepository<HubAdmin, UUID> {

    Optional<HubAdmin> findByUserIdAndStatus(UUID userId, String status);

    Optional<HubAdmin> findByHubId(UUID hubId);

    boolean existsByUserId(UUID userId);

    @Query("""
            SELECT ha FROM HubAdmin ha, DeliveryHub h
            WHERE ha.hubId = h.id
              AND h.townId = :townId
              AND ha.status = :status
              AND h.status = :hubStatus
            """)
    List<HubAdmin> findActiveByTownId(
            @Param("townId") UUID townId,
            @Param("status") String status,
            @Param("hubStatus") String hubStatus);
}
