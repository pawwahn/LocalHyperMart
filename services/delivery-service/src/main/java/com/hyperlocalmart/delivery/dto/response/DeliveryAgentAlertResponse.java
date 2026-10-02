package com.hyperlocalmart.delivery.dto.response;

import com.hyperlocalmart.delivery.entity.DeliveryAgentAlertStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class DeliveryAgentAlertResponse {

    private UUID alertId;
    private UUID assignmentId;
    private UUID orderId;
    private String orderNumber;
    private UUID vendorSubOrderId;
    private String subOrderNumber;
    private String shopName;
    private UUID vendorId;
    private UUID agentId;
    private DeliveryAgentAlertStatus status;
    private String message;
    private Instant createdAt;
    private Instant acknowledgedAt;
}
