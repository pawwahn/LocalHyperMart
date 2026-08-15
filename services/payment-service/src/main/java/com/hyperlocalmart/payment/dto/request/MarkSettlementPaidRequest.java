package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.Instant;

@Data
public class MarkSettlementPaidRequest {

    @NotBlank
    private String payoutMethod;

    @NotBlank
    private String transactionReference;

    private String transactionNotes;

    private Instant paidAt;
}
