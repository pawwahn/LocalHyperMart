package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.CodCloseDayLineItem;
import com.hyperlocalmart.payment.entity.CodCustodianType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CodCloseDayLineItemRepository extends JpaRepository<CodCloseDayLineItem, UUID> {

    @Query("""
            SELECT li.orderId FROM CodCloseDayLineItem li
            WHERE li.orderId IN :orderIds
            """)
    List<UUID> findClosedOrderIds(@Param("orderIds") Collection<UUID> orderIds);

    @Query("""
            SELECT li FROM CodCloseDayLineItem li
            JOIN FETCH li.closeDay c
            WHERE li.orderId IN :orderIds
              AND c.townId = :townId
              AND c.hubId = :hubId
              AND c.custodianType = :custodianType
            """)
    List<CodCloseDayLineItem> findHubCloseLinesForOrders(
            @Param("townId") UUID townId,
            @Param("hubId") UUID hubId,
            @Param("custodianType") CodCustodianType custodianType,
            @Param("orderIds") Collection<UUID> orderIds);
}
