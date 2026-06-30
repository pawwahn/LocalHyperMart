package com.hyperlocalmart.common.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class EventEnvelope {

    private UUID eventId;
    private UUID correlationId;
    private String eventType;
    private String sourceService;
    private String version;
    private Instant timestamp;
    private Map<String, Object> payload;
}
