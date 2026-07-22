package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class CreateVendorSettlementAdjustmentRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID vendorId;

    private UUID shopId;

    @NotNull
    private UUID claimId;

    @NotNull
    private UUID orderId;

    @Size(max = 64)
    private String orderNumber;

    @NotNull
    private UUID orderItemId;

    @NotNull
    private UUID subOrderId;

    @NotNull
    @DecimalMin(value = "0.01")
    private BigDecimal amount;

    @Size(max = 1000)
    private String reason;
}
