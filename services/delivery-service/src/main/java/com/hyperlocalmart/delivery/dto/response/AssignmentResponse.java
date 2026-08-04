package com.hyperlocalmart.delivery.dto.response;

import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.AssignmentStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class AssignmentResponse {

    private UUID assignmentId;
    private String assignmentNumber;
    private UUID orderId;
    private String orderNumber;
    private UUID vendorSubOrderId;
    private String subOrderNumber;
    private UUID townId;
    private UUID hubId;
    private UUID agentId;
    private AssignmentLegType legType;
    private AssignmentStatus status;
    private UUID assignedBy;
    private Instant assignedAt;
    /** First pickup/start action time (boy took bag from shop or hub). */
    private Instant startedAt;
    private Instant completedAt;
    /** Chronological action log for this trip (hub + agent). */
    private List<DeliveryEventResponse> events;

    /** Last-mile: buyer delivery address (null for pickup legs). */
    private String destinationLabel;
    private String destinationName;
    private String destinationPhone;
    private String destinationAddress;
}
