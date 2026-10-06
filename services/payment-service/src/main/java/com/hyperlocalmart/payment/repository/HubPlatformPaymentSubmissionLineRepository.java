package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.HubPlatformPaymentLineType;
import com.hyperlocalmart.payment.entity.HubPlatformPaymentSubmissionLine;
import com.hyperlocalmart.payment.entity.HubPlatformPaymentSubmissionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.UUID;

public interface HubPlatformPaymentSubmissionLineRepository extends JpaRepository<HubPlatformPaymentSubmissionLine, UUID> {

    @Query("""
            SELECT CASE WHEN COUNT(l) > 0 THEN true ELSE false END
            FROM HubPlatformPaymentSubmissionLine l
            JOIN l.submission s
            WHERE s.hubId = :hubId
              AND s.status = :status
              AND l.lineType = :lineType
              AND l.franchisePeriodStart = :periodStart
              AND l.franchisePeriodEnd = :periodEnd
            """)
    boolean existsPendingFranchiseForPeriod(
            @Param("hubId") UUID hubId,
            @Param("status") HubPlatformPaymentSubmissionStatus status,
            @Param("lineType") HubPlatformPaymentLineType lineType,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);

    @Query("""
            SELECT CASE WHEN COUNT(l) > 0 THEN true ELSE false END
            FROM HubPlatformPaymentSubmissionLine l
            JOIN l.submission s
            WHERE s.hubId = :hubId
              AND s.status = :status
              AND l.lineType = :lineType
            """)
    boolean existsPendingLineOfType(
            @Param("hubId") UUID hubId,
            @Param("status") HubPlatformPaymentSubmissionStatus status,
            @Param("lineType") HubPlatformPaymentLineType lineType);

    @Query("""
            SELECT CASE WHEN COUNT(l) > 0 THEN true ELSE false END
            FROM HubPlatformPaymentSubmissionLine l
            JOIN l.submission s
            WHERE s.hubId = :hubId
              AND s.status = :status
              AND l.lineType = :lineType
              AND l.franchisePeriodStart = :periodStart
              AND l.franchisePeriodEnd = :periodEnd
            """)
    boolean existsVerifiedFranchiseForPeriod(
            @Param("hubId") UUID hubId,
            @Param("status") HubPlatformPaymentSubmissionStatus status,
            @Param("lineType") HubPlatformPaymentLineType lineType,
            @Param("periodStart") LocalDate periodStart,
            @Param("periodEnd") LocalDate periodEnd);
}
