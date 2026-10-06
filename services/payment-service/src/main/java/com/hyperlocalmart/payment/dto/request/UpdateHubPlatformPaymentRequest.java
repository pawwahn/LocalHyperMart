package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class UpdateHubPlatformPaymentRequest {

    @NotNull
    private LocalDate paymentDate;

    @NotBlank
    private String paymentReference;

    private String hubNotes;
}
