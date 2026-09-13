package com.hyperlocalmart.town.entity;

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
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "town_history")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TownHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id")
    private UUID townId;

    @Column(name = "actor_user_id", nullable = false)
    private UUID actorUserId;

    @Column(name = "actor_role", length = 50)
    private String actorRole;

    @Column(name = "on_behalf_of_hub_id")
    private UUID onBehalfOfHubId;

    @Column(nullable = false, length = 100)
    private String action;

    @Column(name = "entity_type", length = 100)
    private String entityType;

    @Column(name = "entity_id")
    private UUID entityId;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "before_snapshot", columnDefinition = "jsonb")
    private Map<String, Object> beforeSnapshot;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "after_snapshot", columnDefinition = "jsonb")
    private Map<String, Object> afterSnapshot;

    @Column(name = "correlation_id")
    private UUID correlationId;

    @Column(name = "ip_address", length = 45)
    private String ipAddress;

    @Column(name = "screen_key", length = 50)
    private String screenKey;

    @Column(name = "change_summary", length = 500)
    private String changeSummary;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();
}
