package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SetVendorCodPinRequest {

    @NotBlank
    private String pin;

    @NotBlank
    private String otp;
}
