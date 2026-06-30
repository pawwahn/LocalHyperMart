package com.hyperlocalmart.notification.dto.request;

import com.hyperlocalmart.notification.entity.NotificationChannel;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Data
public class SendNotificationRequest {

    @NotBlank
    private String eventCode;

    private NotificationChannel channel = NotificationChannel.SMS;

    private UUID townId;

    private UUID orderId;

    private UUID recipientUserId;

    private String recipientPhone;

    private Map<String, String> params = new HashMap<>();
}
