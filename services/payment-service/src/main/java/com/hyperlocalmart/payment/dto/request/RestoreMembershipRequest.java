package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class RestoreMembershipRequest {

    @NotNull
    private UUID buyerId;

    @NotNull
    private UUID orderId;

    private String reason;
}
