package com.hyperlocalmart.order.dto.laundry;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AgentLaundryTripCompleteRequest {

    @NotNull
    private UUID agentUserId;

    /** PICKUP_FROM_CUSTOMER or DROP_TO_CUSTOMER */
    private String tripKind;
}
