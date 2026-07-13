package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class ReassignAssignmentRequest {

    @NotNull
    private UUID newAgentId;

    @NotBlank
    private String reason;
}
