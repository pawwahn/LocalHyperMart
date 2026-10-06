package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;
import java.util.UUID;

@Data
public class CreateHubCodPaymentRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID hubId;

    @NotNull
    private String periodKind;

    /** Inclusive start (IST calendar). For DAILY, end defaults to start. */
    @NotNull
    private LocalDate periodStart;

    /** Required for WEEKLY and CUSTOM; optional for DAILY/MONTHLY. */
    private LocalDate periodEnd;
}
