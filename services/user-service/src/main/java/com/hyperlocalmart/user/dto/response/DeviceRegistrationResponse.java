package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class DeviceRegistrationResponse {
    UUID deviceId;
    String appType;
    String platform;
}
