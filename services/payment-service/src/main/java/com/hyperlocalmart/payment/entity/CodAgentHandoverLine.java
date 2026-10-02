package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "cod_agent_handover_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodAgentHandoverLine extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "handover_id", nullable = false)
    private CodAgentHandover handover;

    @Column(name = "order_id", nullable = false, unique = true)
    private UUID orderId;

    @Column(name = "order_number", length = 50)
    private String orderNumber;

    @Column(name = "collect_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal collectAmount;

    @OneToMany(mappedBy = "handoverLine", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @BatchSize(size = 32)
    @Builder.Default
    private List<CodAgentHandoverAllocation> allocations = new ArrayList<>();
}
