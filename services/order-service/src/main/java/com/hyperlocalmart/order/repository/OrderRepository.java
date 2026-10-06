package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.Order;
import com.hyperlocalmart.order.entity.OrderStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OrderRepository extends JpaRepository<Order, UUID> {

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.vendorSubOrders WHERE o.id = :id")
    Optional<Order> findWithSubOrdersById(UUID id);

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.vendorSubOrders WHERE o.id = :id")
    Optional<Order> findAdminDetailById(UUID id);

    @Query("SELECT o FROM Order o LEFT JOIN FETCH o.vendorSubOrders WHERE o.id = :id AND o.buyerId = :buyerId")
    Optional<Order> findDetailedByIdAndBuyerId(UUID id, UUID buyerId);

    Optional<Order> findByIdAndBuyerId(UUID id, UUID buyerId);

    boolean existsByBuyerIdAndStatus(UUID buyerId, OrderStatus status);

    Optional<Order> findByIdAndTownId(UUID id, UUID townId);

    /** Buyer basket/history list — no collection fetch so LIMIT stays in SQL. */
    Page<Order> findByBuyerIdAndTownIdOrderByCreatedAtDesc(UUID buyerId, UUID townId, Pageable pageable);

    @Query("""
            SELECT so.order.id, COALESCE(SUM(i.quantity), 0)
            FROM OrderItem i
            JOIN i.vendorSubOrder so
            WHERE so.order.id IN :orderIds
              AND (i.status IS NULL OR i.status = com.hyperlocalmart.order.entity.OrderItemStatus.ACTIVE)
            GROUP BY so.order.id
            """)
    List<Object[]> sumActiveQtyByOrderId(@Param("orderIds") Collection<UUID> orderIds);

    @EntityGraph(attributePaths = {"vendorSubOrders"})
    Page<Order> findByBuyerIdOrderByCreatedAtDesc(UUID buyerId, Pageable pageable);

    @EntityGraph(attributePaths = {"vendorSubOrders"})
    Page<Order> findByTownIdOrderByCreatedAtDesc(UUID townId, Pageable pageable);

    @EntityGraph(attributePaths = {"vendorSubOrders"})
    Page<Order> findByTownIdAndStatusOrderByCreatedAtDesc(UUID townId, OrderStatus status, Pageable pageable);

    @EntityGraph(attributePaths = {"vendorSubOrders"})
    @Query("""
            SELECT o FROM Order o
            WHERE o.townId = :townId
              AND (:status IS NULL OR o.status = :status)
              AND (
                :q IS NULL OR :q = ''
                OR LOWER(o.orderNumber) LIKE LOWER(CONCAT('%', :q, '%'))
                OR o.buyerPhoneSnapshot LIKE CONCAT('%', :q, '%')
              )
            ORDER BY o.createdAt DESC
            """)
    Page<Order> searchAdminByTown(
            @Param("townId") UUID townId,
            @Param("status") OrderStatus status,
            @Param("q") String q,
            Pageable pageable);

    long countByTownIdAndStatus(UUID townId, OrderStatus status);

    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.townId = :townId
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            """)
    long countPlacedByTownIdAndPlacedAtBetween(UUID townId, Instant start, Instant end);

    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.townId = :townId
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
            """)
    long countDeliveredByTownIdAndDeliveredAtBetween(UUID townId, Instant start, Instant end);

    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.townId = :townId
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.CANCELLED
              AND o.cancelledAt IS NOT NULL
              AND o.cancelledAt >= :start AND o.cancelledAt < :end
            """)
    long countCancelledByTownIdAndCancelledAtBetween(UUID townId, Instant start, Instant end);

    @Query("""
            SELECT o FROM Order o
            WHERE o.townId = :townId
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
            ORDER BY o.deliveredAt ASC
            """)
    List<Order> findDeliveredByTownAndDeliveredAtBetween(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("""
            SELECT o FROM Order o
            WHERE o.id IN :orderIds
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
            """)
    List<Order> findDeliveredByIds(@Param("orderIds") Collection<UUID> orderIds);

    @Query("""
            SELECT o FROM Order o
            WHERE o.townId = :townId
              AND o.paymentMethod = com.hyperlocalmart.order.entity.PaymentMethod.COD
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
            ORDER BY o.deliveredAt ASC
            """)
    List<Order> findCodDeliveredByTownAndDeliveredAtBetween(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("""
            SELECT o FROM Order o
            WHERE o.townId = :townId
              AND o.paymentMethod = com.hyperlocalmart.order.entity.PaymentMethod.COD
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
              AND o.vendorAgentDelivery = :vendorAgentDelivery
            ORDER BY o.deliveredAt ASC
            """)
    List<Order> findCodDeliveredByTownAndDeliveredAtBetweenAndVendorAgentDelivery(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end,
            @Param("vendorAgentDelivery") boolean vendorAgentDelivery);

    @Query("""
            SELECT o FROM Order o
            WHERE o.id IN :orderIds
              AND o.paymentMethod = com.hyperlocalmart.order.entity.PaymentMethod.COD
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
            """)
    List<Order> findCodDeliveredByIds(@Param("orderIds") Collection<UUID> orderIds);

    @Query("""
            SELECT DISTINCT o FROM Order o
            LEFT JOIN FETCH o.vendorSubOrders
            WHERE (:townId IS NULL OR o.townId = :townId)
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            ORDER BY o.placedAt DESC
            """)
    List<Order> findPlacedWithSubsInRange(
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("""
            SELECT DISTINCT o FROM Order o
            LEFT JOIN FETCH o.vendorSubOrders
            WHERE o.buyerId = :buyerId
              AND (:townId IS NULL OR o.townId = :townId)
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            ORDER BY o.placedAt DESC
            """)
    List<Order> findBuyerPlacedWithSubsInRange(
            @Param("buyerId") UUID buyerId,
            @Param("townId") UUID townId,
            @Param("start") Instant start,
            @Param("end") Instant end);

    @Query("""
            SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o
            WHERE o.townId = :townId
              AND o.placedAt IS NOT NULL
              AND o.placedAt >= :start AND o.placedAt < :end
            """)
    java.math.BigDecimal sumPlacedGmvByTown(UUID townId, Instant start, Instant end);

    @Query("""
            SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o
            WHERE o.townId = :townId
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
            """)
    java.math.BigDecimal sumDeliveredGmvByTown(UUID townId, Instant start, Instant end);

    @Query("""
            SELECT COALESCE(SUM(o.totalAmount), 0) FROM Order o
            WHERE o.townId = :townId
              AND o.paymentMethod = com.hyperlocalmart.order.entity.PaymentMethod.COD
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
            """)
    java.math.BigDecimal sumCodDeliveredGmvByTown(UUID townId, Instant start, Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', placed_at))::date AS d, COUNT(*)::bigint
            FROM orders
            WHERE town_id = :townId
              AND placed_at IS NOT NULL
              AND placed_at >= :start AND placed_at < :end
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> countPlacedGroupedByIstDay(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', delivered_at))::date AS d, COUNT(*)::bigint
            FROM orders
            WHERE town_id = :townId
              AND status = 'DELIVERED'
              AND delivered_at IS NOT NULL
              AND delivered_at >= :start AND delivered_at < :end
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> countDeliveredGroupedByIstDay(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', cancelled_at))::date AS d, COUNT(*)::bigint
            FROM orders
            WHERE town_id = :townId
              AND status = 'CANCELLED'
              AND cancelled_at IS NOT NULL
              AND cancelled_at >= :start AND cancelled_at < :end
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> countCancelledGroupedByIstDay(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', delivered_at))::date AS d,
                   COALESCE(SUM(total_amount), 0)
            FROM orders
            WHERE town_id = :townId
              AND status = 'DELIVERED'
              AND delivered_at IS NOT NULL
              AND delivered_at >= :start AND delivered_at < :end
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> sumDeliveredGmvGroupedByIstDay(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', delivered_at))::date AS d,
                   COALESCE(SUM(total_amount), 0)
            FROM orders
            WHERE town_id = :townId
              AND payment_method = 'COD'
              AND status = 'DELIVERED'
              AND delivered_at IS NOT NULL
              AND delivered_at >= :start AND delivered_at < :end
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> sumCodDeliveredGmvGroupedByIstDay(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            SELECT COUNT(o), COALESCE(SUM(o.platformFee), 0), COALESCE(SUM(o.deliveryFee), 0),
                   COALESCE(SUM(o.codFee), 0), COALESCE(SUM(o.taxAmount), 0), COALESCE(SUM(o.totalAmount), 0)
            FROM Order o
            WHERE o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
              AND (:townId IS NULL OR o.townId = :townId)
            """)
    Object[] sumDeliveredCommercialsByTownAndDeliveredAtBetween(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', delivered_at))::date AS d, COUNT(*)::bigint
            FROM orders
            WHERE status = 'DELIVERED'
              AND delivered_at IS NOT NULL
              AND delivered_at >= :start AND delivered_at < :end
              AND (:townId IS NULL OR town_id = CAST(:townId AS uuid))
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> countDeliveredGroupedByIstDayFiltered(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', delivered_at))::date AS d,
                   COALESCE(SUM(total_amount), 0)
            FROM orders
            WHERE status = 'DELIVERED'
              AND delivered_at IS NOT NULL
              AND delivered_at >= :start AND delivered_at < :end
              AND (:townId IS NULL OR town_id = CAST(:townId AS uuid))
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> sumDeliveredGmvGroupedByIstDayFiltered(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query(value = """
            SELECT (timezone('Asia/Kolkata', delivered_at))::date AS d,
                   COALESCE(SUM(platform_fee), 0)
            FROM orders
            WHERE status = 'DELIVERED'
              AND delivered_at IS NOT NULL
              AND delivered_at >= :start AND delivered_at < :end
              AND (:townId IS NULL OR town_id = CAST(:townId AS uuid))
            GROUP BY d
            ORDER BY d
            """, nativeQuery = true)
    List<Object[]> sumPlatformFeeGroupedByIstDayFiltered(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            SELECT COUNT(o) FROM Order o
            WHERE o.townId = :townId
              AND o.paymentMethod = com.hyperlocalmart.order.entity.PaymentMethod.COD
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.DELIVERED
              AND o.deliveredAt IS NOT NULL
              AND o.deliveredAt >= :start AND o.deliveredAt < :end
            """)
    long countCodDeliveredByTownAndDeliveredAtBetween(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);

    @Query("""
            SELECT COALESCE(NULLIF(TRIM(o.cancelReason), ''), 'Unknown'), COUNT(o)
            FROM Order o
            WHERE o.townId = :townId
              AND o.status = com.hyperlocalmart.order.entity.OrderStatus.CANCELLED
              AND o.cancelledAt IS NOT NULL
              AND o.cancelledAt >= :start AND o.cancelledAt < :end
            GROUP BY COALESCE(NULLIF(TRIM(o.cancelReason), ''), 'Unknown')
            ORDER BY COUNT(o) DESC
            """)
    List<Object[]> countCancelReasonsGroupedByTown(
            @Param("townId") UUID townId, @Param("start") Instant start, @Param("end") Instant end);
}
