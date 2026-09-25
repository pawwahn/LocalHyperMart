package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ApplyReferralCodeRequest {

    @NotBlank
    @Size(max = 16)
    private String code;
}
