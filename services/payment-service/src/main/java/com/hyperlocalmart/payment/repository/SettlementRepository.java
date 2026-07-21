package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.Settlement;
import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SettlementRepository extends JpaRepository<Settlement, UUID> {

    @Query("""
            SELECT DISTINCT s FROM Settlement s
            LEFT JOIN FETCH s.lineItems
            WHERE (:townId IS NULL OR s.townId = :townId)
              AND (:payeeType IS NULL OR s.payeeType = :payeeType)
              AND (:payeeId IS NULL OR s.payeeId = :payeeId)
              AND (:status IS NULL OR s.status = :status)
            ORDER BY s.periodEnd DESC, s.createdAt DESC
            """)
    List<Settlement> findFiltered(
            @Param("townId") UUID townId,
            @Param("payeeType") SettlementPayeeType payeeType,
            @Param("payeeId") UUID payeeId,
            @Param("status") SettlementStatus status);

    @Query("SELECT DISTINCT s FROM Settlement s LEFT JOIN FETCH s.lineItems WHERE s.id = :id")
    Optional<Settlement> findDetailedById(@Param("id") UUID id);
}
