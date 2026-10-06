package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SubmitHubPlatformPaymentRequest {

    @NotNull
    private LocalDate paymentDate;

    @NotBlank
    private String paymentReference;

    private String hubNotes;

    /** Must match server-computed payable total to the paisa. */
    @NotNull
    private BigDecimal totalAmount;

    private boolean includeCod;

    private boolean includeFranchise;
}
