package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.CodAgentHandoverLine;
import com.hyperlocalmart.payment.entity.CodAgentHandoverStatus;
import com.hyperlocalmart.payment.entity.CodCustodianType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CodAgentHandoverLineRepository extends JpaRepository<CodAgentHandoverLine, UUID> {

    @Query("SELECT l.orderId FROM CodAgentHandoverLine l WHERE l.orderId IN :orderIds")
    List<UUID> findExistingOrderIds(Collection<UUID> orderIds);

    @Query("""
            SELECT l.orderId FROM CodAgentHandoverLine l
            JOIN l.handover h
            WHERE h.agentId = :agentId AND h.handoverDate = :date AND h.status = :status
            """)
    List<UUID> findDeclaredHandoverOrderIds(
            @Param("agentId") UUID agentId,
            @Param("date") LocalDate date,
            @Param("status") CodAgentHandoverStatus status);

    @Query("""
            SELECT l.orderId FROM CodAgentHandoverLine l
            JOIN l.handover h
            WHERE h.agentId = :agentId
              AND h.handoverDate >= :from AND h.handoverDate <= :to
              AND h.status = :status
            """)
    List<UUID> findDeclaredHandoverOrderIdsBetween(
            @Param("agentId") UUID agentId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("status") CodAgentHandoverStatus status);

    @Query("""
            SELECT h.agentId, l.orderId FROM CodAgentHandoverLine l
            JOIN l.handover h
            WHERE h.agentId IN :agentIds
              AND h.handoverDate >= :from AND h.handoverDate <= :to
              AND h.status = :status
            """)
    List<Object[]> findDeclaredOrderIdsByAgentsBetween(
            @Param("agentIds") Collection<UUID> agentIds,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to,
            @Param("status") CodAgentHandoverStatus status);

    @Query("""
            SELECT DISTINCT l.orderId FROM CodAgentHandoverLine l
            JOIN l.handover h
            WHERE l.orderId IN :orderIds
              AND h.custodianType = :custodianType
              AND h.status = :status
            """)
    List<UUID> findOrderIdsInHandoverWithStatus(
            @Param("orderIds") Collection<UUID> orderIds,
            @Param("custodianType") CodCustodianType custodianType,
            @Param("status") CodAgentHandoverStatus status);

    @Query("""
            SELECT l FROM CodAgentHandoverLine l
            JOIN FETCH l.handover h
            WHERE l.orderId IN :orderIds
            """)
    List<CodAgentHandoverLine> findWithHandoverForOrders(@Param("orderIds") Collection<UUID> orderIds);
}
