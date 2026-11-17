package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class AdminCancellationVendorRiskResponse {
    UUID vendorId;
    String vendorName;
    int fullVendorCancelCount;
    int shopRejectCount;
    int buyerBagCancelCount;
    BigDecimal totalLostAmount;
    Instant lastOccurredAt;
    /** HIGH, MEDIUM, LOW */
    String riskLevel;
    String summary;
}