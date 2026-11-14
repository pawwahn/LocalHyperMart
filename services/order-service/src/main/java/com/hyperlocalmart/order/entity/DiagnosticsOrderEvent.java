package com.hyperlocalmart.order.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "diagnostics_order_events")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagnosticsOrderEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "actor_user_id")
    private UUID actorUserId;

    @Column(name = "actor_staff_id")
    private UUID actorStaffId;

    @Column(name = "actor_roles", length = 200)
    private String actorRoles;

    @Column(name = "event_type", nullable = false, length = 60)
    private String eventType;

    @Column(name = "from_status", length = 40)
    private String fromStatus;

    @Column(name = "to_status", length = 40)
    private String toStatus;

    @Column(length = 500)
    private String note;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
