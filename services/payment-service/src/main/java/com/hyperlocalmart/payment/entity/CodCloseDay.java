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
@Table(name = "cod_close_days")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CodCloseDay extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "hub_id", nullable = false)
    private UUID hubId;

    @Column(name = "agent_id", nullable = false)
    private UUID agentId;

    @Column(name = "close_date", nullable = false)
    private LocalDate closeDate;

    @Column(name = "expected_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal expectedAmount;

    @Column(name = "received_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal receivedAmount;

    @Column(name = "order_count", nullable = false)
    @Builder.Default
    private int orderCount = 0;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private CodCloseDayStatus status;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @OneToMany(mappedBy = "closeDay", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<CodCloseDayLineItem> lineItems = new ArrayList<>();
}
