package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.AdInvoice;
import com.hyperlocalmart.town.entity.AdInvoiceStatus;
import com.hyperlocalmart.town.entity.TownAdSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AdInvoiceRepository extends JpaRepository<AdInvoice, UUID>, JpaSpecificationExecutor<AdInvoice> {

    Optional<AdInvoice> findByInvoiceNumber(String invoiceNumber);

    @Query("""
            SELECT i FROM AdInvoice i
            WHERE i.status IN :statuses
              AND i.slot = :slot
              AND i.slotIndex = :slotIndex
              AND i.fromDate <= :toDate
              AND i.toDate >= :fromDate
            ORDER BY i.fromDate ASC
            """)
    List<AdInvoice> findOverlapping(
            @Param("slot") TownAdSlot slot,
            @Param("slotIndex") int slotIndex,
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            @Param("statuses") List<AdInvoiceStatus> statuses);

    @Query("""
            SELECT i FROM AdInvoice i
            WHERE i.status IN :statuses
              AND i.fromDate <= :toDate
              AND i.toDate >= :fromDate
              AND (:slot IS NULL OR i.slot = :slot)
            ORDER BY i.fromDate ASC, i.slot ASC, i.slotIndex ASC
            """)
    List<AdInvoice> findActiveInRange(
            @Param("fromDate") LocalDate fromDate,
            @Param("toDate") LocalDate toDate,
            @Param("slot") TownAdSlot slot,
            @Param("statuses") List<AdInvoiceStatus> statuses);

    @Query("""
            SELECT i.invoiceNumber FROM AdInvoice i
            WHERE i.invoiceNumber LIKE CONCAT(:prefix, '%')
            ORDER BY i.invoiceNumber DESC
            """)
    List<String> findNumbersForPrefix(@Param("prefix") String prefix, org.springframework.data.domain.Pageable pageable);
}
