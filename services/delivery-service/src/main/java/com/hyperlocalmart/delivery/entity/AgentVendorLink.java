package com.hyperlocalmart.delivery.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.util.UUID;

@Entity
@Table(name = "agent_vendor_links")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentVendorLink extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "shop_id", nullable = false)
    private UUID shopId;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(nullable = false)
    @Builder.Default
    private boolean active = true;
}
