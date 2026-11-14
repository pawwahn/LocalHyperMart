package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class InternalSetPasswordRequest {

    @NotBlank
    @Size(min = 6, max = 72)
    private String newPassword;
}
