package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class PurchaseMembershipRequest {

    @NotBlank
    private String slab;

    /** ONLINE or CASH */
    @NotBlank
    private String channel;

    @NotNull
    private UUID townId;
}
