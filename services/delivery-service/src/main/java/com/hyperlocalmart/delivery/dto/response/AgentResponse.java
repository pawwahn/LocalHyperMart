package com.hyperlocalmart.delivery.dto.response;

import com.hyperlocalmart.delivery.entity.AgentStatus;
import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class AgentResponse {

    UUID agentId;
    UUID userId;
    UUID hubId;
    String name;
    String phone;
    AgentStatus status;
}
