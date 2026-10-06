package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class CreateRazorpaySettlementBatchRequest {

    @NotNull
    private LocalDate settlementDate;

    @NotBlank
    private String utrReference;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal grossAmount;

    @NotNull
    private BigDecimal feeAmount;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal netAmount;

    private Integer paymentCount;

    private String notes;
}
