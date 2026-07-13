package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class HubReportResponse {

    private UUID hubId;
    private UUID townId;
    private String hubName;
    private LocalDate from;
    private LocalDate to;

    private long ordersPlaced;
    private long ordersDelivered;
    private long ordersCancelled;
    private long subOrdersPlaced;
    private long bagsMarkedReady;

    private long shopPickupsCompleted;
    private long homeDeliveriesCompleted;

    private List<AgentPerformanceRow> agents;

    @Data
    @Builder
    public static class AgentPerformanceRow {
        private UUID agentId;
        private String name;
        private String phone;
        private String status;
        private long shopPickupsCompleted;
        private long homeDeliveriesCompleted;
        private long totalCompleted;
    }
}
