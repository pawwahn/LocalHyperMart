package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class HubContactResponse {
    UUID userId;
    UUID hubId;
    String hubName;
    String phone;
}
