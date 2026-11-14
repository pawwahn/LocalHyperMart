package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SetVendorLoginPasswordRequest {

    @NotBlank
    @Size(min = 8, max = 72)
    private String password;
}