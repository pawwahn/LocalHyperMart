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
@Table(name = "hub_platform_payment_submissions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class HubPlatformPaymentSubmission extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "hub_id", nullable = false)
    private UUID hubId;

    @Column(name = "payment_date", nullable = false)
    private LocalDate paymentDate;

    @Column(name = "total_amount", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "payment_reference", nullable = false, length = 120)
    private String paymentReference;

    @Column(name = "hub_notes", columnDefinition = "TEXT")
    private String hubNotes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private HubPlatformPaymentSubmissionStatus status;

    @Column(name = "admin_notes", columnDefinition = "TEXT")
    private String adminNotes;

    @Column(name = "verified_at")
    private Instant verifiedAt;

    @Column(name = "verified_by")
    private UUID verifiedBy;

    @Column(name = "rejected_at")
    private Instant rejectedAt;

    @Column(name = "rejected_by")
    private UUID rejectedBy;

    @Column(name = "payment_request_id")
    private UUID paymentRequestId;

    @Column(name = "hub_details_locked", nullable = false)
    @Builder.Default
    private boolean hubDetailsLocked = false;

    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<HubPlatformPaymentSubmissionLine> lines = new ArrayList<>();
}
