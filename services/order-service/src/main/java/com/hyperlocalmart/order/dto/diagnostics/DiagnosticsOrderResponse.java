package com.hyperlocalmart.order.dto.diagnostics;

import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class DiagnosticsOrderResponse {

    private UUID id;
    private String orderNumber;
    private UUID townId;
    private UUID vendorId;
    private String shopName;
    private UUID buyerId;
    private UUID patientProfileId;
    private String patientName;
    private String referenceType;
    private String referringDoctorName;
    private UUID servingBranchId;
    private String servingBranchLabel;
    private String status;
    private String statusLabel;
    private String paymentMethod;
    private String paymentStatus;
    private BigDecimal testsSubtotal;
    private BigDecimal homeCollectionFee;
    private BigDecimal platformFeeAmount;
    private BigDecimal codFee;
    private BigDecimal totalAmount;
    private BigDecimal amountCollected;
    private UUID addressId;
    private String addressText;
    private String contactName;
    private String contactPhone;
    private Instant slotStart;
    private Instant slotEnd;
    private UUID assignedStaffId;
    private String assignedStaffName;
    private UUID receivedByStaffId;
    private String receivedByStaffName;
    private Instant reportEta;
    private Instant reportFinalizedAt;
    private Instant samplesBenchConfirmedAt;
    private Instant placedAt;

    /** Relative API path when report is finalized (append to gateway base). */
    private String reportDownloadUrl;

    @Builder.Default
    private List<String> reportAttachmentUrls = new ArrayList<>();

    @Builder.Default
    private List<ReportAttachmentResponse> reportAttachments = new ArrayList<>();

    @Builder.Default
    private List<LineResponse> lines = new ArrayList<>();

    @Builder.Default
    private List<String> allowedActions = new ArrayList<>();

    @Builder.Default
    private List<EventResponse> events = new ArrayList<>();

    @Builder.Default
    private List<SamplePhotoResponse> samplePhotos = new ArrayList<>();

    /** Present after place/retry when online payment is started (checkout opens in buyer app). */
    private PaymentInfoResponse payment;

    @Data
    @Builder
    public static class LineResponse {
        private UUID id;
        private UUID testId;
        private String testName;
        private BigDecimal unitPrice;
        private String resultValue;
        private String resultUnit;
        private String referenceRange;
        private String resultFlag;
    }

    @Data
    @Builder
    public static class SamplePhotoResponse {
        private UUID mediaId;
        private String url;
    }

    @Data
    @Builder
    public static class ReportAttachmentResponse {
        private UUID mediaId;
        private String url;
        /** INTERIM or FINAL */
        private String kind;
        private String contentType;
    }

    @Data
    @Builder
    public static class EventResponse {
        private String eventType;
        private String fromStatus;
        private String toStatus;
        private String note;
        private Instant createdAt;
    }
}
