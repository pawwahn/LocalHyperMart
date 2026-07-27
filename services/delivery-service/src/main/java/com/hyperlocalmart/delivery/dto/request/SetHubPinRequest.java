package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class SetHubPinRequest {

    @NotBlank
    private String pin;
}
