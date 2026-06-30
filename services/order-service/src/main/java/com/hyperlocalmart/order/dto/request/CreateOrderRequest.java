package com.hyperlocalmart.order.dto.request;

import com.hyperlocalmart.order.entity.PaymentMethod;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateOrderRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID cartId;

    @NotNull
    private UUID addressId;

    @NotNull
    private PaymentMethod paymentMethod;

    private String paymentGateway;
}
