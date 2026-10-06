package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class SubmitHubPaymentForRequest {

    @NotNull
    private LocalDate paymentDate;

    @NotBlank
    private String paymentReference;

    private String paymentMethod;

    private String bankName;

    private String hubNotes;

    @NotNull
    private BigDecimal totalAmount;
}
