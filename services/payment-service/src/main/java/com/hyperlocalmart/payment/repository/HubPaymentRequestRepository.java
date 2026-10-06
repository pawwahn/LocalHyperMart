package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.HubPaymentRequest;
import com.hyperlocalmart.payment.entity.HubPaymentRequestStatus;
import com.hyperlocalmart.payment.entity.HubPaymentRequestType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface HubPaymentRequestRepository extends JpaRepository<HubPaymentRequest, UUID> {

    @Query("""
            SELECT DISTINCT r FROM HubPaymentRequest r
            LEFT JOIN FETCH r.codLines
            WHERE r.hubId = :hubId
              AND (:type IS NULL OR r.requestType = :type)
            ORDER BY r.createdAt DESC
            """)
    List<HubPaymentRequest> findForHub(
            @Param("hubId") UUID hubId,
            @Param("type") HubPaymentRequestType type);

    @Query("""
            SELECT r FROM HubPaymentRequest r
            WHERE r.townId = :townId
              AND (:hubId IS NULL OR r.hubId = :hubId)
              AND (:type IS NULL OR r.requestType = :type)
            ORDER BY r.createdAt DESC
            """)
    List<HubPaymentRequest> findForAdmin(
            @Param("townId") UUID townId,
            @Param("hubId") UUID hubId,
            @Param("type") HubPaymentRequestType type);

    @Query("""
            SELECT DISTINCT r FROM HubPaymentRequest r
            LEFT JOIN FETCH r.codLines
            WHERE r.id = :id AND r.hubId = :hubId
            """)
    Optional<HubPaymentRequest> findDetailedByIdAndHubId(@Param("id") UUID id, @Param("hubId") UUID hubId);

    @Query("""
            SELECT DISTINCT r FROM HubPaymentRequest r
            LEFT JOIN FETCH r.codLines
            WHERE r.id = :id
            """)
    Optional<HubPaymentRequest> findDetailedById(@Param("id") UUID id);

    List<HubPaymentRequest> findByTownIdAndDocumentNumberIsNullOrderByCreatedAtAscIdAsc(UUID townId);

    boolean existsByHubIdAndRequestTypeAndStatusIn(
            UUID hubId,
            HubPaymentRequestType requestType,
            List<HubPaymentRequestStatus> statuses);

    @Query("""
            SELECT CASE WHEN COUNT(r) > 0 THEN true ELSE false END
            FROM HubPaymentRequest r
            WHERE r.hubId = :hubId
              AND r.requestType = 'FRANCHISE'
              AND r.periodStart = :periodStart
              AND r.periodEnd = :periodEnd
              AND r.status IN :statuses
            """)
    boolean existsFranchiseForPeriod(
            @Param("hubId") UUID hubId,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd,
            @Param("statuses") List<HubPaymentRequestStatus> statuses);

    @Query("""
            SELECT MIN(r.periodStart) FROM HubPaymentRequest r
            WHERE r.hubId = :hubId
              AND r.requestType = com.hyperlocalmart.payment.entity.HubPaymentRequestType.FRANCHISE
            """)
    LocalDate findEarliestFranchiseBillStart(@Param("hubId") UUID hubId);
}
