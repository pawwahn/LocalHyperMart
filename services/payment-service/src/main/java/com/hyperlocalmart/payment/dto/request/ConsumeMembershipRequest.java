package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class ConsumeMembershipRequest {

    @NotNull
    private UUID buyerId;

    @NotNull
    private UUID orderId;

    @NotNull
    private BigDecimal quotedDeliveryFee;
}
