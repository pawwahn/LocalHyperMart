package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class AssignLaundryTripRequest {

    @NotNull
    private UUID laundryOrderId;

    @NotBlank
    private String orderNumber;

    @NotNull
    private UUID townId;

    @NotNull
    private UUID vendorId;

    @NotNull
    private UUID agentId;

    @NotNull
    private UUID assignedBy;

    @NotBlank
    private String shopName;

    private String contactName;

    private String contactPhone;

    @NotBlank
    private String addressText;

    /** PICKUP_FROM_CUSTOMER or DROP_TO_CUSTOMER */
    @NotBlank
    private String tripKind;

    private String paymentMethod;

    private BigDecimal collectCashAmount;
}
