package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "buyer_memberships")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BuyerMembership extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "buyer_id", nullable = false, unique = true)
    private UUID buyerId;

    @Column(name = "buyer_phone_snapshot", length = 15)
    private String buyerPhoneSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(name = "last_slab", nullable = false, length = 20)
    private MembershipSlab lastSlab;

    @Column(name = "credits_remaining", nullable = false)
    @Builder.Default
    private int creditsRemaining = 0;

    @Column(name = "credits_granted_total", nullable = false)
    @Builder.Default
    private int creditsGrantedTotal = 0;

    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;

    @Version
    @Column(nullable = false)
    @Builder.Default
    private long version = 0;
}
