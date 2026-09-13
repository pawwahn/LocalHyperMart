package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class GiftMembershipRequest {

    @NotBlank
    private String phone;

    @NotBlank
    private String slab;

    private String note;
}
