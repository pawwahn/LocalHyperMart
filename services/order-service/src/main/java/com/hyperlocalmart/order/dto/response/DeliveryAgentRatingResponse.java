package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class DeliveryAgentRatingResponse {

    private UUID ratingId;
    private UUID orderId;
    private UUID agentId;
    private int stars;
    private String comment;
}
