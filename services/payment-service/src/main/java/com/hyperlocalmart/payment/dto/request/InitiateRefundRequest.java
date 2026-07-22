package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class InitiateRefundRequest {

    @NotNull
    private UUID orderId;

    /** Optional — payment-service always refunds the SUCCESS capture amount. */
    private BigDecimal amount;

    private String reason;
}
