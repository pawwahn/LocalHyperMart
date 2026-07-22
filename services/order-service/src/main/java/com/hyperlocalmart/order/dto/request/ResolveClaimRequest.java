package com.hyperlocalmart.order.dto.request;

import com.hyperlocalmart.order.entity.ClaimResolution;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ResolveClaimRequest {

    @NotNull
    private ClaimResolution resolution;

    /** Required when resolution is WALLET_CREDIT. */
    @DecimalMin(value = "0.01", inclusive = true)
    private BigDecimal amount;

    @Size(max = 1000)
    private String note;
}
