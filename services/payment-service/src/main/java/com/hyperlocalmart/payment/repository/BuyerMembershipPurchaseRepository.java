package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.BuyerMembershipPurchase;
import com.hyperlocalmart.payment.entity.MembershipPurchaseStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface BuyerMembershipPurchaseRepository extends JpaRepository<BuyerMembershipPurchase, UUID> {

    Optional<BuyerMembershipPurchase> findFirstByBuyerIdAndStatusOrderByCreatedAtDesc(
            UUID buyerId, MembershipPurchaseStatus status);

    List<BuyerMembershipPurchase> findByStatusOrderByCreatedAtDesc(MembershipPurchaseStatus status);

    List<BuyerMembershipPurchase> findByBuyerIdOrderByCreatedAtDesc(UUID buyerId);

    List<BuyerMembershipPurchase> findTop80ByOrderByCreatedAtDesc();

    List<BuyerMembershipPurchase> findByPaidAtGreaterThanEqualAndPaidAtLessThanOrderByPaidAtDesc(
            Instant from, Instant to);

    @Query("""
            select p from BuyerMembershipPurchase p
            where p.status = :status
              and (p.buyerPhoneSnapshot = :phone or p.buyerId = :buyerId)
            order by p.createdAt desc
            """)
    List<BuyerMembershipPurchase> findPendingForBuyer(
            @Param("status") MembershipPurchaseStatus status,
            @Param("phone") String phone,
            @Param("buyerId") UUID buyerId);
}
