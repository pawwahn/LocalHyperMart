package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VendorSubOrderRepository extends JpaRepository<VendorSubOrder, UUID> {

    Optional<VendorSubOrder> findByIdAndVendorId(UUID id, UUID vendorId);

    Page<VendorSubOrder> findByVendorIdOrderByCreatedAtDesc(UUID vendorId, Pageable pageable);

    Page<VendorSubOrder> findByVendorIdAndStatusOrderByCreatedAtDesc(
            UUID vendorId, VendorSubOrderStatus status, Pageable pageable);

    @Query("SELECT v FROM VendorSubOrder v JOIN FETCH v.order JOIN FETCH v.items WHERE v.id = :id AND v.vendorId = :vendorId")
    Optional<VendorSubOrder> findDetailedByIdAndVendorId(UUID id, UUID vendorId);

    @Query("SELECT v FROM VendorSubOrder v JOIN FETCH v.order WHERE v.id = :id")
    Optional<VendorSubOrder> findDetailedById(UUID id);

    @Query("SELECT v FROM VendorSubOrder v JOIN FETCH v.order JOIN FETCH v.items WHERE v.id = :id")
    Optional<VendorSubOrder> findDetailedByIdWithItems(UUID id);

    @Query("""
            SELECT DISTINCT v FROM VendorSubOrder v
            JOIN FETCH v.order o
            LEFT JOIN FETCH v.items
            WHERE o.id = :orderId
            """)
    List<VendorSubOrder> findByOrderIdWithItems(@Param("orderId") UUID orderId);

    @Query("""
            SELECT COUNT(v) FROM VendorSubOrder v JOIN v.order o
            WHERE v.vendorId = :vendorId
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            """)
    long countPlacedSubOrdersByVendorIdAndPlacedAtBetween(UUID vendorId, Instant start, Instant end);

    @Query("""
            SELECT COALESCE(SUM(v.subtotal), 0) FROM VendorSubOrder v JOIN v.order o
            WHERE v.vendorId = :vendorId
              AND v.status <> com.hyperlocalmart.order.entity.VendorSubOrderStatus.VENDOR_REJECTED
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            """)
    BigDecimal sumEarningsByVendorIdAndPlacedAtBetween(UUID vendorId, Instant start, Instant end);

    @Query("""
            SELECT v.status, COUNT(v) FROM VendorSubOrder v JOIN v.order o
            WHERE v.vendorId = :vendorId
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            GROUP BY v.status
            """)
    List<Object[]> countStatusBreakdownByVendorIdAndPlacedAtBetween(UUID vendorId, Instant start, Instant end);

    @Query("""
            SELECT v FROM VendorSubOrder v JOIN FETCH v.order o
            WHERE v.vendorId = :vendorId
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            ORDER BY o.placedAt DESC
            """)
    List<VendorSubOrder> findRecentByVendorIdAndPlacedAtBetween(
            UUID vendorId, Instant start, Instant end, Pageable pageable);

    @Query("""
            SELECT COUNT(v) FROM VendorSubOrder v
            WHERE v.vendorId = :vendorId
              AND v.status = :status
            """)
    long countByVendorIdAndStatus(
            @Param("vendorId") UUID vendorId,
            @Param("status") VendorSubOrderStatus status);

    @Query("""
            SELECT DISTINCT v FROM VendorSubOrder v
            JOIN FETCH v.order o
            LEFT JOIN FETCH v.items
            WHERE v.vendorId = :vendorId
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
              AND (:paymentStatus IS NULL OR o.paymentStatus = :paymentStatus)
            ORDER BY o.placedAt DESC
            """)
    List<VendorSubOrder> findSalesReportByVendorId(
            @Param("vendorId") UUID vendorId,
            @Param("start") Instant start,
            @Param("end") Instant end,
            @Param("paymentStatus") PaymentStatus paymentStatus);

    @Query("""
            SELECT COUNT(v) FROM VendorSubOrder v JOIN v.order o
            WHERE o.townId = :townId
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.PLACED
              AND v.status = com.hyperlocalmart.order.entity.VendorSubOrderStatus.READY_FOR_PICKUP
            """)
    long countReadyForPickupByTownId(UUID townId);

    @Query("""
            SELECT COUNT(v) FROM VendorSubOrder v JOIN v.order o
            WHERE o.townId = :townId
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            """)
    long countByTownIdAndPlacedAtBetween(UUID townId, Instant start, Instant end);

    @Query("""
            SELECT COUNT(v) FROM VendorSubOrder v JOIN v.order o
            WHERE o.townId = :townId
              AND v.readyForPickupAt IS NOT NULL
              AND v.readyForPickupAt >= :start AND v.readyForPickupAt < :end
            """)
    long countMarkedReadyByTownIdAndReadyAtBetween(UUID townId, Instant start, Instant end);

    /** Vendor payout candidates: only delivered bags in the placed-date window. */
    @Query("""
            SELECT DISTINCT v FROM VendorSubOrder v
            JOIN FETCH v.order o
            WHERE v.vendorId = :vendorId
              AND o.townId = :townId
              AND v.status = com.hyperlocalmart.order.entity.VendorSubOrderStatus.DELIVERED
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            ORDER BY o.placedAt DESC
            """)
    List<VendorSubOrder> findSettlementCandidates(
            @Param("vendorId") UUID vendorId,
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    /** Resolve payout selection — only delivered bags may be settled. */
    @Query("""
            SELECT DISTINCT v FROM VendorSubOrder v
            JOIN FETCH v.order o
            WHERE v.vendorId = :vendorId
              AND v.id IN :ids
              AND v.status = com.hyperlocalmart.order.entity.VendorSubOrderStatus.DELIVERED
            """)
    List<VendorSubOrder> findByVendorIdAndIdIn(
            @Param("vendorId") UUID vendorId,
            @Param("ids") Collection<UUID> ids);
}
