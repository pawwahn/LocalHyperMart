package com.hyperlocalmart.notification.dto.response;

import com.hyperlocalmart.notification.entity.NotificationLogStatus;
import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class NotificationResponse {

    private UUID logId;
    private NotificationLogStatus status;
    private String body;
}
