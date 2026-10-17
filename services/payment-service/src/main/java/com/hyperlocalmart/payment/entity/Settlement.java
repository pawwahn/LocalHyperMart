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

    @Enumerated(EnumType.STRING)
    @Column(name = "direction", nullable = false, length = 20)
    @Builder.Default
    private SettlementDirection direction = SettlementDirection.PAYOUT;

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

    /** Vendor confirmed the money reached their account. */
    @Column(name = "vendor_acknowledged_at")
    private Instant vendorAcknowledgedAt;

    @Column(name = "vendor_acknowledged_by")
    private UUID vendorAcknowledgedBy;

    @Column(name = "ack_reminder_count", nullable = false)
    @Builder.Default
    private int ackReminderCount = 0;

    @Column(name = "ack_reminded_at")
    private Instant ackRemindedAt;

    /** Vendor says the payout has not reached their account. */
    @Column(name = "vendor_not_received_at")
    private Instant vendorNotReceivedAt;

    @Column(name = "vendor_not_received_note", length = 500)
    private String vendorNotReceivedNote;

    /** Collection bills (subscription): when admin issued the bill to the vendor. */
    @Column(name = "bill_sent_at")
    private Instant billSentAt;

    /** Vendor says they paid this bill; admin still confirms before status becomes PAID. */
    @Column(name = "vendor_paid_at")
    private Instant vendorPaidAt;

    @Column(name = "vendor_payment_method", length = 32)
    private String vendorPaymentMethod;

    @Column(name = "vendor_payment_reference", length = 128)
    private String vendorPaymentReference;

    @Column(name = "vendor_payment_notes", length = 500)
    private String vendorPaymentNotes;

    /** Date on the bank statement. Separate from {@link #vendorPaidAt}, which is when the vendor told the app. */
    @Column(name = "bank_paid_on")
    private LocalDate bankPaidOn;

    /** Admin rejected the vendor's last submitted payment; vendor may submit again. */
    @Column(name = "vendor_payment_rejected_at")
    private Instant vendorPaymentRejectedAt;

    @Column(name = "vendor_payment_rejected_by")
    private UUID vendorPaymentRejectedBy;

    @Column(name = "vendor_payment_reject_reason", length = 500)
    private String vendorPaymentRejectReason;

    /** Vendor service-fee tax invoice, e.g. KK/26-27/OCT/0001. Blank for hub and agent payouts. */
    @Column(name = "service_invoice_number", length = 48)
    private String serviceInvoiceNumber;

    @OneToMany(mappedBy = "settlement", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @Builder.Default
    private List<SettlementLineItem> lineItems = new ArrayList<>();
}
