package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DeviceTokenInternalResponse {
    String fcmToken;
    String platform;
    String appType;
}
