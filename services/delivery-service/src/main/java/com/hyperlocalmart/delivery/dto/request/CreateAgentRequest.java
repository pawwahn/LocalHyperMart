package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class CreateAgentRequest {

    @NotNull
    private UUID userId;

    @NotBlank
    private String name;

    @NotBlank
    private String phone;
}
