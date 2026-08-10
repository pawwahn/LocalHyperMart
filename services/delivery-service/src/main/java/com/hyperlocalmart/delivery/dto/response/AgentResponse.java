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
    String hubName;
    String name;
    String phone;
    AgentStatus status;
    String govtIdType;
    String govtIdNumber;
    String reference1Name;
    String reference1Phone;
    String reference2Name;
    String reference2Phone;
}
