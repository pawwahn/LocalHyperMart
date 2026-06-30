package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class OrderAssignmentResponse {

    UUID assignmentId;
    UUID agentId;
    String legType;
    String status;
    Instant assignedAt;
    Instant completedAt;
}
