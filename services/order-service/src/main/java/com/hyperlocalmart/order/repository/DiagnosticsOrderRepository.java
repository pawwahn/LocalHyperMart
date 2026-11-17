package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus;
import com.hyperlocalmart.order.entity.DiagnosticsOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DiagnosticsOrderRepository extends JpaRepository<DiagnosticsOrder, UUID> {

    java.util.Optional<DiagnosticsOrder> findByOrderNumber(String orderNumber);

    List<DiagnosticsOrder> findByBuyerIdAndTownIdOrderByPlacedAtDesc(UUID buyerId, UUID townId);

    List<DiagnosticsOrder> findByTownIdAndStatusAndUpdatedAtGreaterThanEqualAndUpdatedAtLessThanOrderByUpdatedAtDesc(
            UUID townId,
            DiagnosticsOrderStatus status,
            Instant updatedAtAfter,
            Instant updatedAtBefore);

    List<DiagnosticsOrder> findByVendorIdOrderByPlacedAtDesc(UUID vendorId);

    long countByServingBranchIdAndSlotStartAndStatusNot(UUID branchId, Instant slotStart, DiagnosticsOrderStatus status);

    List<DiagnosticsOrder> findByAssignedStaffIdAndStatusIn(UUID assignedStaffId, Collection<DiagnosticsOrderStatus> statuses);

    long countByAssignedStaffIdAndStatusIn(UUID assignedStaffId, Collection<DiagnosticsOrderStatus> statuses);

    @Query(
            """
            SELECT o FROM DiagnosticsOrder o
            WHERE o.assignedStaffId = :staffId
              AND o.status IN :statuses
              AND (
                (o.reportFinalizedAt IS NOT NULL AND o.reportFinalizedAt >= :from AND o.reportFinalizedAt < :toExclusive)
                OR (o.reportFinalizedAt IS NULL AND o.placedAt >= :from AND o.placedAt < :toExclusive)
              )
            ORDER BY o.reportFinalizedAt DESC NULLS LAST, o.placedAt DESC
            """)
    List<DiagnosticsOrder> findCollectorHistory(
            @Param("staffId") UUID staffId,
            @Param("statuses") Collection<DiagnosticsOrderStatus> statuses,
            @Param("from") Instant from,
            @Param("toExclusive") Instant toExclusive);

    @Query("""
            select o from DiagnosticsOrder o
            where o.vendorId = :vendorId
              and o.townId = :townId
              and o.status in (
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.RECEIVED_AT_LAB,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_ETA_SET,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_IN_PROGRESS,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_FINALIZED,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.COMPLETED)
              and (
                  (o.paymentMethod = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod.UPI
                      and o.paymentStatus = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.PAID)
                  or (o.paymentMethod = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod.COD
                      and o.paymentStatus in (
                          com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.COLLECTED,
                          com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.PAID))
              )
              and coalesce(o.samplesReceivedAtLabAt, o.reportFinalizedAt, o.updatedAt, o.placedAt) >= :start
              and coalesce(o.samplesReceivedAtLabAt, o.reportFinalizedAt, o.updatedAt, o.placedAt) < :end
            order by coalesce(o.samplesReceivedAtLabAt, o.reportFinalizedAt, o.updatedAt, o.placedAt) asc
            """)
    List<DiagnosticsOrder> findSettlementCandidates(
            @Param("vendorId") UUID vendorId,
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    List<DiagnosticsOrder> findByVendorIdAndIdIn(UUID vendorId, Collection<UUID> ids);

    @Query("""
            select o.vendorId, o.townId, o.id
            from DiagnosticsOrder o
            where o.status in (
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.RECEIVED_AT_LAB,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_ETA_SET,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_IN_PROGRESS,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_FINALIZED,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.COMPLETED)
              and (
                  (o.paymentMethod = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod.UPI
                      and o.paymentStatus = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.PAID)
                  or (o.paymentMethod = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod.COD
                      and o.paymentStatus in (
                          com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.COLLECTED,
                          com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.PAID))
              )
              and coalesce(o.samplesReceivedAtLabAt, o.reportFinalizedAt, o.updatedAt, o.placedAt) >= :start
              and coalesce(o.samplesReceivedAtLabAt, o.reportFinalizedAt, o.updatedAt, o.placedAt) < :end
            """)
    List<Object[]> findSettlementKeys(@Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            select distinct o.vendorId, o.townId
            from DiagnosticsOrder o
            where o.status in (
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.RECEIVED_AT_LAB,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_ETA_SET,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_IN_PROGRESS,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.REPORT_FINALIZED,
                  com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.COMPLETED)
              and (
                  (o.paymentMethod = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod.UPI
                      and o.paymentStatus = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.PAID)
                  or (o.paymentMethod = com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod.COD
                      and o.paymentStatus in (
                          com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.COLLECTED,
                          com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus.PAID))
              )
              and coalesce(o.samplesReceivedAtLabAt, o.reportFinalizedAt, o.updatedAt, o.placedAt) >= :start
              and coalesce(o.samplesReceivedAtLabAt, o.reportFinalizedAt, o.updatedAt, o.placedAt) < :end
            """)
    List<Object[]> findDeliveredVendorTowns(@Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            select o from DiagnosticsOrder o
            where o.vendorId = :vendorId
              and o.status <> com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.CANCELLED
              and o.status <> com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus.AWAITING_PAYMENT
              and coalesce(o.reportFinalizedAt, o.updatedAt, o.placedAt) >= :start
              and coalesce(o.reportFinalizedAt, o.updatedAt, o.placedAt) < :end
            order by coalesce(o.reportFinalizedAt, o.updatedAt, o.placedAt) desc
            """)
    List<DiagnosticsOrder> findSalesReportByVendorId(
            @Param("vendorId") UUID vendorId, @Param("start") Instant start, @Param("end") Instant end);
}
