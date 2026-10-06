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
@Table(name = "hub_payment_requests")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HubPaymentRequest extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "hub_id", nullable = false)
    private UUID hubId;

    @Enumerated(EnumType.STRING)
    @Column(name = "request_type", nullable = false, length = 16)
    private HubPaymentRequestType requestType;

    @Enumerated(EnumType.STRING)
    @Column(name = "period_kind", nullable = false, length = 16)
    private HubPaymentRequestPeriodKind periodKind;

    @Column(name = "period_start", nullable = false)
    private LocalDate periodStart;

    @Column(name = "period_end", nullable = false)
    private LocalDate periodEnd;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "franchise_label", length = 255)
    private String franchiseLabel;

    /** Town sequence, e.g. CLX/FR/26-27/0001 — not a UUID fragment. */
    @Column(name = "document_number", length = 40)
    private String documentNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24)
    private HubPaymentRequestStatus status;

    @Column(name = "submission_id")
    private UUID submissionId;

    @OneToMany(mappedBy = "request", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<HubPaymentRequestCodLine> codLines = new ArrayList<>();
}
