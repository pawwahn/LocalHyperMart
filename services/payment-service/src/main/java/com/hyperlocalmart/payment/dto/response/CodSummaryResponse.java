package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.UUID;

@Value
@Builder
public class CodSummaryResponse {
    UUID townId;
    UUID hubId;
    String date;
    int closeCount;
    int orderCount;
    BigDecimal expectedAmount;
    BigDecimal receivedAmount;
    int matchedCount;
    int discrepancyCount;
}
