package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AssignLastMileRequest {

    @NotNull
    private UUID orderId;

    @NotNull
    private UUID agentId;
}
