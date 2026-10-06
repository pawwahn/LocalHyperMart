package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.CodHubPlatformRemittance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface CodHubPlatformRemittanceRepository extends JpaRepository<CodHubPlatformRemittance, UUID> {

    @Query("""
            SELECT COALESCE(SUM(r.amount), 0) FROM CodHubPlatformRemittance r
            WHERE r.townId = :townId AND r.hubId = :hubId
            """)
    BigDecimal sumAmountByTownAndHub(@Param("townId") UUID townId, @Param("hubId") UUID hubId);

    @Query("""
            SELECT COALESCE(SUM(r.amount), 0) FROM CodHubPlatformRemittance r
            WHERE r.townId = :townId AND r.hubId = :hubId
              AND r.remittanceDate >= :from AND r.remittanceDate <= :to
            """)
    BigDecimal sumAmountByTownHubAndDateRange(
            @Param("townId") UUID townId,
            @Param("hubId") UUID hubId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to);

    List<CodHubPlatformRemittance> findByTownIdAndHubIdAndRemittanceDateBetweenOrderByRemittanceDateDescCreatedAtDesc(
            UUID townId, UUID hubId, LocalDate from, LocalDate to);

    List<CodHubPlatformRemittance> findByRemittanceDateBetweenOrderByRemittanceDateAscCreatedAtAsc(
            LocalDate from, LocalDate to);

    List<CodHubPlatformRemittance> findByTownIdAndRemittanceDateBetweenOrderByRemittanceDateAscCreatedAtAsc(
            UUID townId, LocalDate from, LocalDate to);
}
