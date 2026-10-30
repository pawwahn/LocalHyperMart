package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.UUID;

@Value
@Builder
public class CollectedSuccessBatchItem {
    UUID orderId;
    BigDecimal amount;
}
