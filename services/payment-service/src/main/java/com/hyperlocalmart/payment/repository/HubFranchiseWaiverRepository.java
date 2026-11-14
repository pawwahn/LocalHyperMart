package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.HubFranchiseWaiver;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface HubFranchiseWaiverRepository extends JpaRepository<HubFranchiseWaiver, UUID> {

    boolean existsByHubIdAndPeriodStart(UUID hubId, LocalDate periodStart);

    @Query("""
            SELECT w.hubId, w.periodStart FROM HubFranchiseWaiver w
            WHERE w.periodEnd >= :from AND w.periodStart <= :to
            """)
    List<Object[]> findKeysBetween(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
