package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDate;

@Data
public class PreviewHubCodForMeRequest {

    @NotNull
    private String periodKind;

    @NotNull
    private LocalDate periodStart;

    private LocalDate periodEnd;
}
