package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.CodAgentHandover;
import com.hyperlocalmart.payment.entity.CodAgentHandoverStatus;
import com.hyperlocalmart.payment.entity.CodCustodianType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CodAgentHandoverRepository extends JpaRepository<CodAgentHandover, UUID> {

    List<CodAgentHandover> findByAgentIdAndHandoverDateOrderByCreatedAtDesc(UUID agentId, LocalDate handoverDate);

    List<CodAgentHandover> findByAgentIdAndHandoverDateBetweenOrderByCreatedAtDesc(
            UUID agentId, LocalDate from, LocalDate to);

    @Query("""
            SELECT DISTINCT h FROM CodAgentHandover h
            LEFT JOIN FETCH h.lines
            WHERE h.agentId = :agentId
              AND h.handoverDate >= :from AND h.handoverDate <= :to
            ORDER BY h.createdAt DESC
            """)
    List<CodAgentHandover> findRecentWithLinesForAgent(
            @Param("agentId") UUID agentId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("""
            SELECT DISTINCT h FROM CodAgentHandover h
            LEFT JOIN FETCH h.lines
            WHERE h.status = :status AND h.handoverDate = :date
            ORDER BY h.createdAt DESC
            """)
    List<CodAgentHandover> findByStatusAndHandoverDate(
            @Param("status") CodAgentHandoverStatus status,
            @Param("date") LocalDate handoverDate);

    @Query("""
            SELECT DISTINCT h FROM CodAgentHandover h
            LEFT JOIN FETCH h.lines
            WHERE h.id = :id
            """)
    Optional<CodAgentHandover> findDetailedById(@Param("id") UUID id);

    List<CodAgentHandover> findByTownIdAndHandoverDateBetweenOrderByHandoverDateDesc(
            UUID townId, LocalDate from, LocalDate to);

    @Query("""
            SELECT DISTINCT h FROM CodAgentHandover h
            LEFT JOIN FETCH h.lines
            WHERE h.status = :status
              AND h.custodianType = :custodianType
              AND h.vendorId = :vendorId
              AND h.handoverDate >= :from AND h.handoverDate <= :to
            ORDER BY h.createdAt DESC
            """)
    List<CodAgentHandover> findDeclaredByVendorBetween(
            @Param("status") CodAgentHandoverStatus status,
            @Param("custodianType") CodCustodianType custodianType,
            @Param("vendorId") UUID vendorId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("""
            SELECT DISTINCT h FROM CodAgentHandover h
            LEFT JOIN FETCH h.lines
            WHERE h.status = :status
              AND h.custodianType = :custodianType
              AND h.hubId = :hubId
              AND h.handoverDate >= :from AND h.handoverDate <= :to
            ORDER BY h.createdAt DESC
            """)
    List<CodAgentHandover> findDeclaredByHubBetween(
            @Param("status") CodAgentHandoverStatus status,
            @Param("custodianType") CodCustodianType custodianType,
            @Param("hubId") UUID hubId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);
}
