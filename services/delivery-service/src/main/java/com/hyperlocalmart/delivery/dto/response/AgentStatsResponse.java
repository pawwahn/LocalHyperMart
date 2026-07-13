package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class AgentStatsResponse {

    long vendorPickupsCollected;
    long vendorPickupsAtHub;
    long buyerDeliveriesCompleted;
    long vendorPickupsCollectedToday;
    long vendorPickupsAtHubToday;
    long buyerDeliveriesCompletedToday;
}
