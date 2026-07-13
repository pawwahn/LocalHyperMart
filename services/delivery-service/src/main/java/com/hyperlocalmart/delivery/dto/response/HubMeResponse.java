package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class HubMeResponse {

    UUID hubId;
    UUID townId;
    String hubName;
    String address;
    String phone;
}
