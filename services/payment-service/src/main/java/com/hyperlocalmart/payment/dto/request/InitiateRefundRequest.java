package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class InitiateRefundRequest {

    @NotNull
    private UUID orderId;

    @NotNull
    private BigDecimal amount;

    private String reason;
}
