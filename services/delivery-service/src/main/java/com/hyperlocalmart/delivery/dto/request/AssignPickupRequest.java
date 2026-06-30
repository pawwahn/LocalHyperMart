package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AssignPickupRequest {

    @NotNull
    private UUID vendorSubOrderId;

    @NotNull
    private UUID agentId;
}
