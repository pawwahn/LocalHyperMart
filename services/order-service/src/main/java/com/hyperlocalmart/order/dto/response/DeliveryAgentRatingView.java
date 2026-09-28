package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class DeliveryAgentRatingView {

    private boolean canRate;
    private String agentName;
    private Integer stars;
    private String comment;
}
