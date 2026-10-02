package com.hyperlocalmart.delivery.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "delivery_agent_alerts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeliveryAgentAlert {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "assignment_id", nullable = false)
    private UUID assignmentId;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "vendor_sub_order_id", nullable = false)
    private UUID vendorSubOrderId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "shop_id")
    private UUID shopId;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DeliveryAgentAlertStatus status;

    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "created_by", nullable = false)
    private UUID createdBy;

    @Column(name = "acknowledged_by")
    private UUID acknowledgedBy;

    @Column(name = "acknowledged_at")
    private Instant acknowledgedAt;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
