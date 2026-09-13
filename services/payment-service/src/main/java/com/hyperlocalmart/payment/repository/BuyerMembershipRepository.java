package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.BuyerMembership;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BuyerMembershipRepository extends JpaRepository<BuyerMembership, UUID> {

    Optional<BuyerMembership> findByBuyerId(UUID buyerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from BuyerMembership m where m.buyerId = :buyerId")
    Optional<BuyerMembership> lockByBuyerId(@Param("buyerId") UUID buyerId);

    List<BuyerMembership> findTop100ByOrderByUpdatedAtDesc();

    @Query("""
            select count(m) from BuyerMembership m
            where m.expiresAt > :now and m.creditsRemaining > 0
            """)
    long countActive(@Param("now") Instant now);

    @Query("""
            select coalesce(sum(m.creditsRemaining), 0) from BuyerMembership m
            where m.expiresAt > :now
            """)
    long sumUsableCredits(@Param("now") Instant now);

    @Query("""
            select count(m) from BuyerMembership m
            where m.expiresAt > :now and m.expiresAt <= :until and m.creditsRemaining > 0
            """)
    long countExpiringBetween(@Param("now") Instant now, @Param("until") Instant until);
}
