package com.hyperlocalmart.payment.dto.request;

import com.hyperlocalmart.payment.entity.PaymentGateway;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class InitiatePaymentRequest {

    @NotNull
    private UUID orderId;

    @NotNull
    private UUID townId;

    @NotNull
    private PaymentGateway gateway;
}
