package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class HubDashboardResponse {

    private UUID hubId;
    private UUID townId;
    private String hubName;
    private long activeAgents;
    private OrderQueueCounts orders;
    private LegStatusCounts pickups;
    private LegStatusCounts lastMile;
    private long activeAssignments;

    @Data
    @Builder
    public static class OrderQueueCounts {
        private long readyForPickup;
        private long placedAwaitingDelivery;
    }

    @Data
    @Builder
    public static class LegStatusCounts {
        private long assigned;
        private long inProgress;
        private long completedToday;
    }
}
