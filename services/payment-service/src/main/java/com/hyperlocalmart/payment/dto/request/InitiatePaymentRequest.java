package com.hyperlocalmart.payment.dto.request;

import com.hyperlocalmart.payment.entity.PaymentGateway;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class InitiatePaymentRequest {

    @NotNull
    private UUID orderId;

    @NotNull
    private UUID townId;

    @NotNull
    private PaymentGateway gateway;

    private String buyerPhone;

    /** When set, payment-service skips a round-trip to order-service (needed while create-order TX is open). */
    private BigDecimal amount;

    private String orderNumber;

    private String orderStatus;

    private String paymentMethod;
}
