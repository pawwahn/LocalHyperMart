package com.hyperlocalmart.order.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "delivery_agent_ratings")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryAgentRating {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false, unique = true)
    private UUID orderId;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    @Column(name = "agent_name_snapshot", length = 120)
    private String agentNameSnapshot;

    @Column(nullable = false)
    private short stars;

    @Column(length = 400)
    private String comment;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }
}
