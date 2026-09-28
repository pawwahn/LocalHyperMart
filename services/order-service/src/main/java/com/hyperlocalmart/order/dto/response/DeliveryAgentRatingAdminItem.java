package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class DeliveryAgentRatingAdminItem {

    private UUID ratingId;
    private UUID orderId;
    private String orderNumber;
    private UUID agentId;
    private String agentName;
    private UUID townId;
    private int stars;
    private String comment;
    private Instant createdAt;
}
