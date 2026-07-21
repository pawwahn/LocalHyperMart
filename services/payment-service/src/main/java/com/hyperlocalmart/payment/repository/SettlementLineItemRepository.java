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
              AND s.payeeType = com.hyperlocalmart.payment.entity.SettlementPayeeType.VENDOR
              AND s.payeeId = :vendorId
            """)
    List<SettlementLineItem> findByVendorAndSubOrderIds(
            @Param("vendorId") UUID vendorId,
            @Param("subOrderIds") Collection<UUID> subOrderIds);

    @Query("""
            SELECT li.subOrderId FROM SettlementLineItem li
            JOIN li.settlement s
            WHERE li.subOrderId IN :subOrderIds
              AND s.status IN :statuses
            """)
    List<UUID> findSettledSubOrderIds(
            @Param("subOrderIds") Collection<UUID> subOrderIds,
            @Param("statuses") Collection<SettlementStatus> statuses);
}
