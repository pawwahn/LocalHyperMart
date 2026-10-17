package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;

@Data
public class CorrectVendorPayoutRequest {

    @NotBlank
    @Size(max = 40)
    private String payoutMethod;

    @NotBlank
    @Size(max = 255)
    private String transactionReference;

    @Size(max = 2000)
    private String transactionNotes;

    private Instant paidAt;
}
