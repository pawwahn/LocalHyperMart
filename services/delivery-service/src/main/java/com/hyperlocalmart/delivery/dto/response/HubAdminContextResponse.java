package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class HubAdminContextResponse {

    UUID userId;
    UUID hubId;
    UUID townId;
}
