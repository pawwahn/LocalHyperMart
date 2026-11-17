package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class AdminCancellationBuyerRiskResponse {
    UUID buyerId;
    String buyerPhone;
    int fullCancelCount;
    int partialCancelCount;
    int vendorRejectEvents;
    BigDecimal totalLostAmount;
    Instant lastOccurredAt;
    /** HIGH, MEDIUM, LOW */
    String riskLevel;
    String summary;
}