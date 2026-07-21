package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.OrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.UUID;

public interface OrderItemRepository extends JpaRepository<OrderItem, UUID> {

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
