package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class WalletCreditRequest {

    @NotNull
    private UUID userId;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal amount;

    @NotBlank
    private String referenceType;

    @NotNull
    private UUID referenceId;

    private UUID orderId;
    private UUID orderItemId;
    private String note;
}
