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
public class HubPlatformPaymentReceiptResponse {

    String receiptNumber;
    UUID submissionId;
    UUID townId;
    UUID hubId;
    String hubName;
    String status;
    String statusLabel;
    String documentTitle;
    String paymentDate;
    BigDecimal totalAmount;
    BigDecimal linesTotal;
    boolean amountsConsistent;
    String paymentReference;
    String hubNotes;
    String adminNotes;
    Instant submittedAt;
    Instant verifiedAt;
    Instant generatedAt;

    @Builder.Default
    List<Line> lines = new ArrayList<>();

    @Value
    @Builder
    public static class Line {
        UUID lineId;
        String lineType;
        String lineDescription;
        BigDecimal amount;
        String franchisePeriodStart;
        String franchisePeriodEnd;
        String franchiseLabel;
        UUID codRemittanceId;
        UUID franchiseSettlementId;
    }
}
