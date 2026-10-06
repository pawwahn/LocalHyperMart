package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class HubPaymentRequestResponse {

    private UUID requestId;
    private UUID townId;
    private UUID hubId;
    private String requestType;
    private String periodKind;
    private String periodStart;
    private String periodEnd;
    private BigDecimal totalAmount;
    private String franchiseLabel;
    private String status;
    private String statusLabel;
    private String documentRef;
    private UUID submissionId;
    private Instant issuedAt;
    private Integer orderCount;
    private List<CodLine> codLines;

    @Data
    @Builder
    public static class CodLine {
        private UUID lineId;
        private UUID orderId;
        private String orderNumber;
        private String closeDate;
        private BigDecimal amount;
    }
}
