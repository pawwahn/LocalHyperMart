package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class HubAssignmentReportResponse {

    private UUID hubId;
    private LocalDate from;
    private LocalDate to;
    private List<TripRow> trips;

    @Data
    @Builder
    public static class TripRow {
        private UUID assignmentId;
        private String assignmentNumber;
        private String orderNumber;
        private String subOrderNumber;
        private UUID agentId;
        private String agentName;
        private String agentPhone;
        private String legType;
        private Instant completedAt;
    }
}
