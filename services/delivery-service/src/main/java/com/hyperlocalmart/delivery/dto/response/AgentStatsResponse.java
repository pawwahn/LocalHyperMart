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

    long openShopPickups;
    long openHomeDeliveries;
    long returnsToHub;
    long returnsToHubToday;

    AgentPeriodStats today;
    AgentPeriodStats week;
    AgentPeriodStats month;
    AgentPeriodStats allTime;

    @Value
    @Builder
    public static class AgentPeriodStats {
        long shopPicked;
        long droppedAtHub;
        long homeDelivered;
        long returnsToHub;
        long cancelledPickups;
    }
}
