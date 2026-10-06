package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class VerifyVendorCodPinRequest {

    @NotBlank
    private String pin;
}
