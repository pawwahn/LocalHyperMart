package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Value
@Builder
public class DeliveryEventResponse {
    UUID eventId;
    String eventType;
    Instant createdAt;
    UUID createdBy;
    Map<String, Object> metadata;
}
