package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateHubFranchisePaymentRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID hubId;

    @NotNull
    @Min(2000)
    @Max(2100)
    private Integer billingYear;

    @NotNull
    @Min(1)
    @Max(12)
    private Integer billingMonth;
}
