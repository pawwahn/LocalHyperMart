package com.hyperlocalmart.order.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class PaymentCallbackRequest {

    @NotNull
    private UUID buyerId;

    @NotNull
    private UUID paymentId;

    private String gateway;

    private String reason;
}
