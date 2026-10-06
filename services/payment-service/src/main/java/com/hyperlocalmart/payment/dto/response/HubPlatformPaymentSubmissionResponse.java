package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class HubPlatformPaymentSubmissionResponse {

    UUID submissionId;
    UUID townId;
    UUID hubId;
    String status;
    String statusLabel;
    String paymentDate;
    BigDecimal totalAmount;
    String paymentReference;
    String hubNotes;
    String adminNotes;
    Instant submittedAt;
    Instant verifiedAt;
    Instant rejectedAt;
    boolean editable;

    @Builder.Default
    List<Line> lines = new ArrayList<>();

    @Value
    @Builder
    public static class Line {
        UUID lineId;
        String lineType;
        BigDecimal amount;
        String franchisePeriodStart;
        String franchisePeriodEnd;
        String franchiseLabel;
    }
}
