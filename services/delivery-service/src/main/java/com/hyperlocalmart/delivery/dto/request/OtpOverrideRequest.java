package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class OtpOverrideRequest {

    @NotBlank
    private String reason;
}
