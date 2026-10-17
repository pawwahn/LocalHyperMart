package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.LocalDate;

/** Admin correction so the bill matches the bank statement. Does not change the vendor ack time. */
@Data
public class CorrectSubscriptionPaymentRequest {
    @NotNull
    private LocalDate bankPaidOn;
    @NotBlank
    @Size(max = 32)
    private String payoutMethod;
    @NotBlank
    @Size(max = 128)
    private String transactionReference;
    @Size(max = 500)
    private String transactionNotes;
}
