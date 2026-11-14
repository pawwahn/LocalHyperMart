package com.hyperlocalmart.order.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import com.hyperlocalmart.order.diagnostics.DiagnosticsOrderStatus;
import com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentMethod;
import com.hyperlocalmart.order.diagnostics.DiagnosticsPaymentStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "diagnostics_orders")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagnosticsOrder extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "order_number", nullable = false, length = 24)
    private String orderNumber;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Column(name = "vendor_id", nullable = false)
    private UUID vendorId;

    @Column(name = "shop_name", nullable = false, length = 150)
    private String shopName;

    @Column(name = "buyer_id", nullable = false)
    private UUID buyerId;

    @Column(name = "patient_profile_id", nullable = false)
    private UUID patientProfileId;

    @Column(name = "patient_name", nullable = false, length = 120)
    private String patientName;

    @Column(name = "reference_type", nullable = false, length = 20)
    private String referenceType;

    @Column(name = "referring_doctor_name", length = 120)
    private String referringDoctorName;

    @Column(name = "serving_branch_id", nullable = false)
    private UUID servingBranchId;

    @Column(name = "serving_branch_label", length = 120)
    private String servingBranchLabel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private DiagnosticsOrderStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_method", nullable = false, length = 20)
    private DiagnosticsPaymentMethod paymentMethod;

    @Enumerated(EnumType.STRING)
    @Column(name = "payment_status", nullable = false, length = 20)
    private DiagnosticsPaymentStatus paymentStatus;

    @Column(name = "tests_subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal testsSubtotal;

    @Column(name = "home_collection_fee", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal homeCollectionFee = BigDecimal.ZERO;

    @Column(name = "platform_fee_amount", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal platformFeeAmount = BigDecimal.ZERO;

    @Column(name = "cod_fee", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal codFee = BigDecimal.ZERO;

    @Column(name = "amount_collected", nullable = false, precision = 12, scale = 2)
    @Builder.Default
    private BigDecimal amountCollected = BigDecimal.ZERO;

    @Column(name = "address_id", nullable = false)
    private UUID addressId;

    @Column(name = "address_text", nullable = false, length = 500)
    private String addressText;

    @Column(name = "contact_name", length = 120)
    private String contactName;

    @Column(name = "contact_phone", length = 15)
    private String contactPhone;

    @Column(name = "slot_start", nullable = false)
    private Instant slotStart;

    @Column(name = "slot_end", nullable = false)
    private Instant slotEnd;

    @Column(name = "assigned_staff_id")
    private UUID assignedStaffId;

    @Column(name = "assigned_staff_name", length = 120)
    private String assignedStaffName;

    @Column(name = "received_by_staff_id")
    private UUID receivedByStaffId;

    @Column(name = "received_by_staff_name", length = 120)
    private String receivedByStaffName;

    @Column(name = "report_eta")
    private Instant reportEta;

    @Column(name = "report_finalized_at")
    private Instant reportFinalizedAt;

    /** Comma-separated media UUIDs, max 5 sample photos. */
    @Column(name = "sample_photo_media_ids", length = 400)
    private String samplePhotoMediaIds;

    /** Lab bench confirms patient name matches the received bag before finalizing. */
    @Column(name = "samples_bench_confirmed_at")
    private Instant samplesBenchConfirmedAt;

    /** Lab bench receipt — payout / fee-bill clock starts here (not report finalize). */
    @Column(name = "samples_received_at_lab_at")
    private Instant samplesReceivedAtLabAt;

    /** Pipe-delimited mediaId|INTERIM|FINAL entries, max 5 report file attachments. */
    @Column(name = "report_attachment_meta", length = 2000)
    private String reportAttachmentMeta;

    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;
}
