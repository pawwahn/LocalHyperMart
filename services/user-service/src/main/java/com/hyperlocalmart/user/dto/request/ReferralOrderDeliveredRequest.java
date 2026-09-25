package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ReferralOrderDeliveredRequest {

    @NotNull
    private UUID buyerId;

    @NotNull
    private UUID orderId;
}
