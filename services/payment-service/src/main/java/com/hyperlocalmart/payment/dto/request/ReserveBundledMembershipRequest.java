package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ReserveBundledMembershipRequest {

    @NotNull
    private UUID buyerId;

    private String buyerPhone;

    @NotNull
    private UUID townId;

    @NotBlank
    private String slab;

    @NotNull
    private UUID orderId;

    private boolean codOrder;

    private String idempotencyKey;
}
