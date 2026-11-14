package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ResetAppAdminPasswordRequest {

    @NotBlank
    @Size(min = 8, max = 100)
    private String password;
}
