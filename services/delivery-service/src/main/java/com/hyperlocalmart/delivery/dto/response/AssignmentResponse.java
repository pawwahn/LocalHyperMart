package com.hyperlocalmart.delivery.dto.response;

import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.AssignmentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class AssignmentResponse {

    private UUID assignmentId;
    private UUID orderId;
    private UUID vendorSubOrderId;
    private UUID townId;
    private UUID hubId;
    private UUID agentId;
    private AssignmentLegType legType;
    private AssignmentStatus status;
    private UUID assignedBy;
    private Instant assignedAt;
    private Instant completedAt;
}
