package com.hyperlocalmart.order.dto.laundry;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AgentLaundryCashRequest {

    @NotNull
    private UUID agentUserId;

    /** PICKUP_FROM_CUSTOMER or DROP_TO_CUSTOMER */
    @NotBlank
    private String tripKind;

    /** COLLECTED or NOT_COLLECTED (drop leg only allows COLLECTED). */
    @NotBlank
    private String outcome;
}
