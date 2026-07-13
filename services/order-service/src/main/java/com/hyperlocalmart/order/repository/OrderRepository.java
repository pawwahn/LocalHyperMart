package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.Order;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.hyperlocalmart.order.entity.OrderStatus;

import java.time.Instant;
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

    Optional<Order> findByIdAndTownId(UUID id, UUID townId);

    @EntityGraph(attributePaths = {"vendorSubOrders"})
    Page<Order> findByBuyerIdAndTownIdOrderByCreatedAtDesc(UUID buyerId, UUID townId, Pageable pageable);

    @EntityGraph(attributePaths = {"vendorSubOrders"})
    Page<Order> findByTownIdOrderByCreatedAtDesc(UUID townId, Pageable pageable);

    @EntityGraph(attributePaths = {"vendorSubOrders"})
    Page<Order> findByTownIdAndStatusOrderByCreatedAtDesc(UUID townId, OrderStatus status, Pageable pageable);

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
}
