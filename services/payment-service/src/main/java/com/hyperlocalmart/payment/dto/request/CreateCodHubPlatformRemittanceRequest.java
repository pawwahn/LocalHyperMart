package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

@Data
public class CreateCodHubPlatformRemittanceRequest {
    @NotNull
    private UUID townId;
    @NotNull
    private UUID hubId;
    private LocalDate remittanceDate;
    @NotNull
    @DecimalMin(value = "0.01", message = "amount must be positive")
    private BigDecimal amount;
    private String reference;
    private String notes;
}
