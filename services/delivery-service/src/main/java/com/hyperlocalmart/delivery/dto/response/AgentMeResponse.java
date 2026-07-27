package com.hyperlocalmart.delivery.dto.response;

import com.hyperlocalmart.delivery.entity.AgentStatus;
import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class AgentMeResponse {

    UUID agentId;
    UUID userId;
    String name;
    String phone;
    AgentStatus status;
    UUID hubId;
    UUID townId;
}
