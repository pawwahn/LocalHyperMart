package com.hyperlocalmart.notification.client;

import lombok.Data;

@Data
public class DeviceTokenView {
    private String fcmToken;
    private String platform;
    private String appType;
}
