package com.hyperlocalmart.order.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class PaymentCallbackRequest {

    @NotNull
    private UUID buyerId;

    @NotNull
    private UUID paymentId;

    private String gateway;

    /** Gateway capture amount for this payment (partial prepay uses less than order total). */
    private BigDecimal amount;

    private String reason;
}
