package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.UUID;

@Value
@Builder
public class WalletTransactionResponse {
    UUID id;
    String type;
    BigDecimal amount;
    BigDecimal balanceAfter;
    String referenceType;
    UUID referenceId;
    UUID orderId;
    UUID orderItemId;
    String note;
    /** ISO-8601 timestamp string for simple JSON clients. */
    String createdAt;
    /** Buyer-friendly one-line title for the UI. */
    String title;
}
