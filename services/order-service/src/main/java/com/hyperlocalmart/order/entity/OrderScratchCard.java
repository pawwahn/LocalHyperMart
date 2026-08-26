package com.hyperlocalmart.order.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "order_scratch_cards")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class OrderScratchCard {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false, unique = true)
    private UUID orderId;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ScratchCardStatus status;

    @Column(name = "reward_min", nullable = false, precision = 12, scale = 2)
    private BigDecimal rewardMin;

    @Column(name = "reward_max", nullable = false, precision = 12, scale = 2)
    private BigDecimal rewardMax;

    @Column(name = "revealed_amount", precision = 12, scale = 2)
    private BigDecimal revealedAmount;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "revealed_at")
    private Instant revealedAt;
}
