package com.hyperlocalmart.payment.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "hub_platform_payment_submission_lines")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HubPlatformPaymentSubmissionLine extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submission_id", nullable = false)
    private HubPlatformPaymentSubmission submission;

    @Enumerated(EnumType.STRING)
    @Column(name = "line_type", nullable = false, length = 32)
    private HubPlatformPaymentLineType lineType;

    @Column(nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "franchise_period_start")
    private LocalDate franchisePeriodStart;

    @Column(name = "franchise_period_end")
    private LocalDate franchisePeriodEnd;

    @Column(name = "franchise_label", length = 255)
    private String franchiseLabel;

    @Column(name = "cod_remittance_id")
    private UUID codRemittanceId;

    @Column(name = "franchise_settlement_id")
    private UUID franchiseSettlementId;
}
