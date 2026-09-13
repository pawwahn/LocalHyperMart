package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.BuyerMembershipLedger;
import com.hyperlocalmart.payment.entity.MembershipLedgerType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public interface BuyerMembershipLedgerRepository extends JpaRepository<BuyerMembershipLedger, UUID> {

    boolean existsByOrderIdAndEntryType(UUID orderId, MembershipLedgerType entryType);

    @Query("""
            select coalesce(sum(l.creditsDelta), 0) from BuyerMembershipLedger l
            where l.entryType = :type and l.createdAt >= :from and l.createdAt < :to
            """)
    long sumCredits(@Param("type") MembershipLedgerType type, @Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select count(l) from BuyerMembershipLedger l
            where l.entryType = :type and l.createdAt >= :from and l.createdAt < :to
            """)
    long countEntries(@Param("type") MembershipLedgerType type, @Param("from") Instant from, @Param("to") Instant to);

    @Query("""
            select coalesce(sum(l.deliveryFeeWaived), 0) from BuyerMembershipLedger l
            where l.entryType = com.hyperlocalmart.payment.entity.MembershipLedgerType.CONSUME
              and l.createdAt >= :from and l.createdAt < :to
            """)
    BigDecimal sumWaived(@Param("from") Instant from, @Param("to") Instant to);
}
