package com.hyperlocalmart.order.dto.request;

import com.hyperlocalmart.order.entity.ClaimType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateClaimRequest {

    @NotNull
    private ClaimType claimType;

    /** Required — which delivered line has the issue. */
    @NotNull
    private UUID orderItemId;

    @NotBlank
    @Size(max = 1000)
    private String reason;
}
