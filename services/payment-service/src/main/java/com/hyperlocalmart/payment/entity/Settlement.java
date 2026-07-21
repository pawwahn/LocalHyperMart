package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "settlements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Settlement extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Enumerated(EnumType.STRING)
    @Column(name = "payee_type", nullable = false, length = 20)
    private SettlementPayeeType payeeType;

    @Column(name = "payee_id", nullable = false)
    private UUID payeeId;

    @Column(name = "payee_name")
    private String payeeName;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Enumerated(EnumType.STRING)
    @Column(name = "period_type", nullable = false, length = 20)
    @Builder.Default
    private SettlementPeriodType periodType = SettlementPeriodType.CUSTOM;

    @Column(name = "gross_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal grossAmount;

    @Column(name = "commission_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal commissionAmount = BigDecimal.ZERO;

    @Column(name = "net_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal netAmount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private SettlementStatus status;

    @Column(name = "payout_method", length = 40)
    private String payoutMethod;

    @Column(name = "transaction_reference")
    private String transactionReference;

    @Column(name = "transaction_notes", columnDefinition = "TEXT")
    private String transactionNotes;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "paid_by")
    private UUID paidBy;

    @OneToMany(mappedBy = "settlement", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<SettlementLineItem> lineItems = new ArrayList<>();
}
