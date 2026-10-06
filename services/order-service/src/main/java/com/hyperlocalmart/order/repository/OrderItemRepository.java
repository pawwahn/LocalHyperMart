package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.OrderItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

    @Query("""
            SELECT oi.listingId
            FROM OrderItem oi
            JOIN oi.vendorSubOrder vso
            JOIN vso.order o
            WHERE o.buyerId = :buyerId
              AND o.townId = :townId
              AND o.status IN (
                    com.hyperlocalmart.order.entity.OrderStatus.PLACED,
                    com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
                  )
              AND (oi.status IS NULL OR oi.status = com.hyperlocalmart.order.entity.OrderItemStatus.ACTIVE)
            ORDER BY COALESCE(o.placedAt, o.createdAt) DESC, oi.createdAt DESC
            """)
    List<UUID> findRecentListingIds(
            @Param("buyerId") UUID buyerId,
            @Param("townId") UUID townId,
            Pageable pageable);

    @Query("""
            SELECT COALESCE(SUM(i.lineTotal), 0)
            FROM OrderItem i
            WHERE i.vendorSubOrder.id = :subOrderId
              AND (i.status IS NULL OR i.status = com.hyperlocalmart.order.entity.OrderItemStatus.ACTIVE)
            """)
    BigDecimal sumActiveLineTotalsForSubOrder(@Param("subOrderId") UUID subOrderId);

    @Query("""
            SELECT COALESCE(SUM(i.lineTotal), 0)
            FROM OrderItem i
            WHERE i.vendorSubOrder.order.id = :orderId
              AND (i.status IS NULL OR i.status = com.hyperlocalmart.order.entity.OrderItemStatus.ACTIVE)
            """)
    BigDecimal sumActiveLineTotalsForOrder(@Param("orderId") UUID orderId);

    @Query("""
            SELECT COALESCE(SUM(i.cgstAmount), 0), COALESCE(SUM(i.sgstAmount), 0), COALESCE(SUM(i.igstAmount), 0)
            FROM OrderItem i
            JOIN i.vendorSubOrder vso
            JOIN vso.order o
            WHERE o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
              AND (:townId IS NULL OR o.townId = :townId)
              AND (i.status IS NULL OR i.status = com.hyperlocalmart.order.entity.OrderItemStatus.ACTIVE)
            """)
    Object[] sumGstOnDeliveredOrders(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', o.delivered_at))::date AS d,
                   COALESCE(SUM(i.cgst_amount + i.sgst_amount + i.igst_amount), 0)
            FROM order_items i
            JOIN vendor_sub_orders vso ON vso.id = i.vendor_sub_order_id
            JOIN orders o ON o.id = vso.order_id
            WHERE o.status = 'DELIVERED'
              AND o.delivered_at IS NOT NULL
              AND o.delivered_at >= :start AND o.delivered_at < :end
              AND (:townId IS NULL OR o.town_id = CAST(:townId AS uuid))
              AND (i.status IS NULL OR i.status = 'ACTIVE')
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> sumGstGroupedByDeliveredIstDay(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT COALESCE(NULLIF(TRIM(i.hsn_code_snapshot), ''), 'UNMAPPED') AS hsn,
                   COALESCE(i.gst_percent_snapshot, 0) AS gst_pct,
                   COUNT(*) AS lines,
                   COALESCE(SUM(i.taxable_value), 0) AS taxable,
                   COALESCE(SUM(i.cgst_amount), 0) AS cgst,
                   COALESCE(SUM(i.sgst_amount), 0) AS sgst,
                   COALESCE(SUM(i.igst_amount), 0) AS igst,
                   COALESCE(SUM(i.cess_amount), 0) AS cess,
                   COALESCE(SUM(i.line_total), 0) AS amount
            FROM order_items i
            JOIN vendor_sub_orders vso ON vso.id = i.vendor_sub_order_id
            JOIN orders o ON o.id = vso.order_id
            WHERE o.status = 'DELIVERED'
              AND o.delivered_at IS NOT NULL
              AND o.delivered_at >= :start AND o.delivered_at < :end
              AND (:townId IS NULL OR o.town_id = CAST(:townId AS uuid))
              AND (i.status IS NULL OR i.status = 'ACTIVE')
            GROUP BY 1, 2
            ORDER BY amount DESC
            """, nativeQuery = true)
    List<Object[]> sumGstByHsnOnDelivered(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);
}
