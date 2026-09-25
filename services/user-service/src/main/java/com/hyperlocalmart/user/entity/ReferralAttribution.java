package com.hyperlocalmart.user.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "referral_attributions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReferralAttribution {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "referee_user_id", nullable = false, unique = true)
    private UUID refereeUserId;

    @Column(name = "referrer_user_id", nullable = false)
    private UUID referrerUserId;

    @Column(name = "referral_code", nullable = false, length = 16)
    private String referralCode;

    @Column(name = "referee_reward_credited", nullable = false)
    private boolean refereeRewardCredited;

    @Column(name = "referrer_reward_credited", nullable = false)
    private boolean referrerRewardCredited;

    @Column(name = "qualifying_order_id")
    private UUID qualifyingOrderId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "referrer_credited_at")
    private Instant referrerCreditedAt;
}
