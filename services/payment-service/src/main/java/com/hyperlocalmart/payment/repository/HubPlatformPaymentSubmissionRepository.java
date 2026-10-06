package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.HubPlatformPaymentLineType;
import com.hyperlocalmart.payment.entity.HubPlatformPaymentSubmission;
import com.hyperlocalmart.payment.entity.HubPlatformPaymentSubmissionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubPlatformPaymentSubmissionRepository extends JpaRepository<HubPlatformPaymentSubmission, UUID> {

    boolean existsByHubIdAndStatus(UUID hubId, HubPlatformPaymentSubmissionStatus status);

    @Query("""
            SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END
            FROM HubPlatformPaymentSubmission s
            JOIN s.lines l
            WHERE s.hubId = :hubId
              AND s.status = :status
              AND l.lineType = :lineType
            """)
    boolean existsPendingWithLineType(
            @Param("hubId") UUID hubId,
            @Param("status") HubPlatformPaymentSubmissionStatus status,
            @Param("lineType") HubPlatformPaymentLineType lineType);

    @Query("""
            SELECT DISTINCT s FROM HubPlatformPaymentSubmission s
            LEFT JOIN FETCH s.lines
            WHERE s.hubId = :hubId
            ORDER BY s.createdAt DESC
            """)
    List<HubPlatformPaymentSubmission> findByHubIdOrderByCreatedAtDesc(@Param("hubId") UUID hubId);

    @Query("""
            SELECT DISTINCT s FROM HubPlatformPaymentSubmission s
            LEFT JOIN FETCH s.lines
            WHERE s.townId = :townId AND s.hubId = :hubId
            ORDER BY s.createdAt DESC
            """)
    List<HubPlatformPaymentSubmission> findByTownIdAndHubIdOrderByCreatedAtDesc(
            @Param("townId") UUID townId, @Param("hubId") UUID hubId);

    @Query("""
            SELECT DISTINCT s FROM HubPlatformPaymentSubmission s
            LEFT JOIN FETCH s.lines
            WHERE s.townId = :townId AND s.status = :status
            ORDER BY s.createdAt DESC
            """)
    List<HubPlatformPaymentSubmission> findByTownIdAndStatusOrderByCreatedAtDesc(
            @Param("townId") UUID townId, @Param("status") HubPlatformPaymentSubmissionStatus status);

    @Query("""
            SELECT s FROM HubPlatformPaymentSubmission s
            WHERE s.townId = :townId AND s.status = :status
            ORDER BY s.createdAt DESC
            """)
    List<HubPlatformPaymentSubmission> listPendingForTown(
            @Param("townId") UUID townId, @Param("status") HubPlatformPaymentSubmissionStatus status);

    Optional<HubPlatformPaymentSubmission> findByIdAndHubId(UUID id, UUID hubId);

    @Query("""
            SELECT s FROM HubPlatformPaymentSubmission s
            LEFT JOIN FETCH s.lines
            WHERE s.id = :id AND s.hubId = :hubId
            """)
    Optional<HubPlatformPaymentSubmission> findDetailedByIdAndHubId(@Param("id") UUID id, @Param("hubId") UUID hubId);
}
