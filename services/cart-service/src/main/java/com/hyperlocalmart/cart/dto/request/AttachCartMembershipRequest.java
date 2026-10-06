package com.hyperlocalmart.cart.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class AttachCartMembershipRequest {

    @NotNull
    private UUID townId;

    @NotBlank
    private String slab;
}
