package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.SettlementLineItem;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface SettlementLineItemRepository extends JpaRepository<SettlementLineItem, UUID> {

    List<SettlementLineItem> findBySubOrderIdIn(Collection<UUID> subOrderIds);

    @Query("""
            SELECT li FROM SettlementLineItem li
            JOIN FETCH li.settlement s
            WHERE li.subOrderId IN :subOrderIds
              AND li.lineType = 'ORDER'
              AND s.payeeType = com.hyperlocalmart.payment.entity.SettlementPayeeType.VENDOR
              AND s.payeeId = :vendorId
            """)
    List<SettlementLineItem> findByVendorAndSubOrderIds(
            @Param("vendorId") UUID vendorId,
            @Param("subOrderIds") Collection<UUID> subOrderIds);

    @Query("""
            SELECT li.orderId FROM SettlementLineItem li
            JOIN li.settlement s
            WHERE li.orderId IN :orderIds
              AND li.lineType = 'DELIVERY_ORDER'
              AND s.payeeType = :payeeType
              AND s.payeeId = :payeeId
              AND s.status IN :statuses
            """)
    List<UUID> findSettledDeliveryOrderIds(
            @Param("orderIds") Collection<UUID> orderIds,
            @Param("payeeType") com.hyperlocalmart.payment.entity.SettlementPayeeType payeeType,
            @Param("payeeId") UUID payeeId,
            @Param("statuses") Collection<SettlementStatus> statuses);

    @Query("""
            SELECT li.subOrderId FROM SettlementLineItem li
            JOIN li.settlement s
            WHERE li.subOrderId IN :subOrderIds
              AND li.lineType = 'ORDER'
              AND s.status IN :statuses
            """)
    List<UUID> findSettledSubOrderIds(
            @Param("subOrderIds") Collection<UUID> subOrderIds,
            @Param("statuses") Collection<SettlementStatus> statuses);
}
