package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class RejectRegistrationRequest {

    @NotBlank
    @Size(max = 1000)
    private String reason;
}
