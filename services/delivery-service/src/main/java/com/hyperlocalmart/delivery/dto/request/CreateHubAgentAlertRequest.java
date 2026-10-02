package com.hyperlocalmart.delivery.dto.request;

import lombok.Data;

import java.util.UUID;

@Data
public class CreateHubAgentAlertRequest {

    private UUID townId;
    private UUID actorUserId;
}
