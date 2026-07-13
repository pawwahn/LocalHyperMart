package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class OrderAssignmentResponse {

    UUID assignmentId;
    String assignmentNumber;
    String orderNumber;
    String subOrderNumber;
    UUID agentId;
    String legType;
    String status;
    Instant assignedAt;
    Instant startedAt;
    Instant completedAt;
    List<DeliveryEventResponse> events;
}
