package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ConsumeCodPinOtpRequest {

    @NotBlank
    private String otp;
}
