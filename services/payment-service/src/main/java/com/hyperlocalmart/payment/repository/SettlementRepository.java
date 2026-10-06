package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.Settlement;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SettlementRepository extends JpaRepository<Settlement, UUID> {

    @Query("""
            SELECT DISTINCT s FROM Settlement s
            LEFT JOIN FETCH s.lineItems
            WHERE (:townId IS NULL OR s.townId = :townId)
              AND (:payeeType IS NULL OR s.payeeType = :payeeType)
              AND (:payeeId IS NULL OR s.payeeId = :payeeId)
              AND (:status IS NULL OR s.status = :status)
            ORDER BY s.periodEnd DESC, s.createdAt DESC
            """)
    List<Settlement> findFiltered(
            @Param("townId") UUID townId,
            @Param("payeeType") SettlementPayeeType payeeType,
            @Param("payeeId") UUID payeeId,
            @Param("status") SettlementStatus status);

    @Query("""
            SELECT s FROM Settlement s
            WHERE s.payeeType = :payeeType
              AND s.payeeId = :payeeId
              AND s.direction = com.hyperlocalmart.payment.entity.SettlementDirection.COLLECTION
              AND s.status IN :statuses
              AND s.periodStart = :periodStart
              AND s.periodEnd = :periodEnd
            """)
    List<Settlement> findFranchiseCollections(
            @Param("payeeType") SettlementPayeeType payeeType,
            @Param("payeeId") UUID payeeId,
            @Param("periodStart") java.time.LocalDate periodStart,
            @Param("periodEnd") java.time.LocalDate periodEnd,
            @Param("statuses") List<SettlementStatus> statuses);

    @Query("""
            SELECT s FROM Settlement s
            WHERE s.payeeType = :payeeType
              AND s.payeeId = :payeeId
              AND s.direction = com.hyperlocalmart.payment.entity.SettlementDirection.COLLECTION
              AND s.status IN :statuses
            """)
    List<Settlement> findAnyFranchiseCollections(
            @Param("payeeType") SettlementPayeeType payeeType,
            @Param("payeeId") UUID payeeId,
            @Param("statuses") List<SettlementStatus> statuses);

    @Query("SELECT DISTINCT s FROM Settlement s LEFT JOIN FETCH s.lineItems WHERE s.id = :id")
    Optional<Settlement> findDetailedById(@Param("id") UUID id);

    @Query("""
            SELECT DISTINCT s FROM Settlement s
            LEFT JOIN FETCH s.lineItems
            WHERE s.status = com.hyperlocalmart.payment.entity.SettlementStatus.PAID
              AND s.paidAt IS NOT NULL
              AND s.paidAt >= :start AND s.paidAt < :endExclusive
              AND (:townId IS NULL OR s.townId = :townId)
            ORDER BY s.paidAt ASC
            """)
    List<Settlement> findPaidWithLinesBetween(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("endExclusive") Instant endExclusive);

    @Query("""
            SELECT s FROM Settlement s
            WHERE s.payeeType = com.hyperlocalmart.payment.entity.SettlementPayeeType.VENDOR
              AND s.status = com.hyperlocalmart.payment.entity.SettlementStatus.PAID
              AND s.paidAt IS NOT NULL
              AND s.paidAt >= :start AND s.paidAt < :endExclusive
              AND (:townId IS NULL OR s.townId = :townId)
            ORDER BY s.paidAt ASC
            """)
    List<Settlement> findPaidVendorSettlementsBetween(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("endExclusive") Instant endExclusive);

    @Query("""
            SELECT s FROM Settlement s
            WHERE s.direction = com.hyperlocalmart.payment.entity.SettlementDirection.PAYOUT
              AND s.status <> com.hyperlocalmart.payment.entity.SettlementStatus.PAID
              AND (:townId IS NULL OR s.townId = :townId)
            ORDER BY s.createdAt ASC
            """)
    List<Settlement> findUnpaidPayouts(@Param("townId") UUID townId);
}
