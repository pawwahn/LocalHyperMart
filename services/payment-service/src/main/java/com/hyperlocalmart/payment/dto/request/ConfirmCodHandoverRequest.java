package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class ConfirmCodHandoverRequest {
    @NotNull
    private UUID handoverId;
    @NotNull
    private BigDecimal receivedAmount;
    private String pin;
    private String notes;
    /** Required when custodian is a vendor shop. */
    private UUID vendorId;
}
