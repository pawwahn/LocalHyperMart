package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.OrderItem;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
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
}
