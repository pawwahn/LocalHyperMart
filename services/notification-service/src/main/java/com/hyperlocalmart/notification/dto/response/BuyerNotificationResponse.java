package com.hyperlocalmart.notification.dto.response;

import com.hyperlocalmart.notification.entity.NotificationChannel;
import com.hyperlocalmart.notification.entity.NotificationLogStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class BuyerNotificationResponse {

    private UUID id;
    private UUID orderId;
    private String eventCode;
    private NotificationChannel channel;
    private String body;
    private NotificationLogStatus status;
    private Instant createdAt;
}
