package com.hyperlocalmart.delivery.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "hub_admins")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HubAdmin extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "hub_id", nullable = false)
    private UUID hubId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "pin_hash")
    private String pinHash;

    @Column(nullable = false, length = 30)
    @Builder.Default
    private String status = "ACTIVE";
}
