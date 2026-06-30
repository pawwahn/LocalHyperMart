package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.VendorSubOrder;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.Instant;
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
}
