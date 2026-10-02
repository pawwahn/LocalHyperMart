package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "cod_agent_handovers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodAgentHandover extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    @Column(name = "agent_user_id", nullable = false)
    private UUID agentUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "custodian_type", nullable = false, length = 20)
    private CodCustodianType custodianType;

    @Column(name = "hub_id")
    private UUID hubId;

    @Column(name = "vendor_id")
    private UUID vendorId;

    @Column(name = "handover_date", nullable = false)
    private LocalDate handoverDate;

    @Column(name = "declared_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal declaredAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CodAgentHandoverStatus status;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "handover", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<CodAgentHandoverLine> lines = new ArrayList<>();
}
