package com.hyperlocalmart.order.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class DeliverOrderRequest {

    @NotNull
    private UUID agentUserId;

    private String recipientName;

    /** Set for a shop-agent delivery so only that bag is completed. */
    private UUID vendorSubOrderId;
}
