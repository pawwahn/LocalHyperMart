package com.hyperlocalmart.delivery.dto.request;

import com.hyperlocalmart.delivery.entity.AgentStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateAgentStatusRequest {

    @NotNull
    private AgentStatus status;
}
