package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.CodCloseDay;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CodCloseDayRepository extends JpaRepository<CodCloseDay, UUID> {

    @Query("""
            SELECT DISTINCT c FROM CodCloseDay c
            LEFT JOIN FETCH c.lineItems
            WHERE c.townId = :townId
              AND c.hubId = :hubId
              AND c.closeDate = :closeDate
            ORDER BY c.createdAt DESC
            """)
    List<CodCloseDay> findByTownHubAndDate(
            @Param("townId") UUID townId,
            @Param("hubId") UUID hubId,
            @Param("closeDate") LocalDate closeDate);

    @Query("""
            SELECT DISTINCT c FROM CodCloseDay c
            LEFT JOIN FETCH c.lineItems
            WHERE c.townId = :townId
              AND c.hubId = :hubId
              AND c.closeDate >= :from
              AND c.closeDate <= :to
            ORDER BY c.closeDate DESC, c.createdAt DESC
            """)
    List<CodCloseDay> findByTownHubAndDateRange(
            @Param("townId") UUID townId,
            @Param("hubId") UUID hubId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    @Query("SELECT DISTINCT c FROM CodCloseDay c LEFT JOIN FETCH c.lineItems WHERE c.id = :id")
    Optional<CodCloseDay> findDetailedById(@Param("id") UUID id);
}
