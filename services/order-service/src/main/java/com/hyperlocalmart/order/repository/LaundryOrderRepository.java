package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.LaundryOrder;
import com.hyperlocalmart.order.laundry.LaundryOrderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface LaundryOrderRepository extends JpaRepository<LaundryOrder, UUID> {

    List<LaundryOrder> findByBuyerIdAndTownIdOrderByPlacedAtDesc(UUID buyerId, UUID townId);

    List<LaundryOrder> findByVendorIdOrderByPlacedAtDesc(UUID vendorId);

    List<LaundryOrder> findByTownIdOrderByPlacedAtDesc(UUID townId);

    @Query("""
            select coalesce(sum(l.quantity), 0)
            from LaundryOrderLine l
            join l.order o
            where o.vendorId = :vendorId
              and o.status <> :cancelled
              and o.status <> com.hyperlocalmart.order.laundry.LaundryOrderStatus.AWAITING_PAYMENT
              and o.placedAt >= :from
              and o.placedAt < :to
            """)
    long piecesBooked(
            @Param("vendorId") UUID vendorId,
            @Param("cancelled") LaundryOrderStatus cancelled,
            @Param("from") Instant from,
            @Param("to") Instant to);

    @Query("""
            select coalesce(sum(o.codFee), 0)
            from LaundryOrder o
            where o.status = com.hyperlocalmart.order.laundry.LaundryOrderStatus.DELIVERED
              and o.deliveredAt is not null
              and o.deliveredAt >= :start and o.deliveredAt < :end
              and (:townId is null or o.townId = :townId)
            """)
    BigDecimal sumDeliveredCodFee(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("""
            select coalesce(sum(o.platformFeeAmount), 0)
            from LaundryOrder o
            where o.status = com.hyperlocalmart.order.laundry.LaundryOrderStatus.DELIVERED
              and o.deliveredAt is not null
              and o.deliveredAt >= :start and o.deliveredAt < :end
              and (:townId is null or o.townId = :townId)
            """)
    BigDecimal sumDeliveredPlatformFee(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', delivered_at))::date AS d,
                   COALESCE(SUM(platform_fee_amount), 0)
            FROM laundry_orders
            WHERE status = 'DELIVERED'
              AND delivered_at IS NOT NULL
              AND delivered_at >= :start AND delivered_at < :end
              AND (:townId IS NULL OR town_id = CAST(:townId AS uuid))
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> sumDeliveredPlatformFeeGroupedByIstDay(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("""
            select coalesce(sum(o.platformFeeAmount), 0)
            from LaundryOrder o
            where o.status <> com.hyperlocalmart.order.laundry.LaundryOrderStatus.CANCELLED
              and o.placedAt >= :start and o.placedAt < :end
              and (:townId is null or o.townId = :townId)
            """)
    BigDecimal sumOpenPlatformFee(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("""
            select o from LaundryOrder o
            where o.vendorId = :vendorId
              and o.townId = :townId
              and o.status = com.hyperlocalmart.order.laundry.LaundryOrderStatus.DELIVERED
              and coalesce(o.deliveredAt, o.placedAt) >= :start
              and coalesce(o.deliveredAt, o.placedAt) < :end
            order by coalesce(o.deliveredAt, o.placedAt) asc
            """)
    List<LaundryOrder> findSettlementCandidates(
            @Param("vendorId") UUID vendorId,
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    List<LaundryOrder> findByVendorIdAndIdIn(UUID vendorId, Collection<UUID> ids);

    @Query("""
            select o.vendorId, o.townId, o.id
            from LaundryOrder o
            where o.status = com.hyperlocalmart.order.laundry.LaundryOrderStatus.DELIVERED
              and coalesce(o.deliveredAt, o.placedAt) >= :start
              and coalesce(o.deliveredAt, o.placedAt) < :end
            """)
    List<Object[]> findSettlementKeys(@Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            select distinct o.vendorId, o.townId
            from LaundryOrder o
            where o.status = com.hyperlocalmart.order.laundry.LaundryOrderStatus.DELIVERED
              and coalesce(o.deliveredAt, o.placedAt) >= :start
              and coalesce(o.deliveredAt, o.placedAt) < :end
            """)
    List<Object[]> findDeliveredVendorTowns(@Param("start") Instant start, @Param("end") Instant end);
}
