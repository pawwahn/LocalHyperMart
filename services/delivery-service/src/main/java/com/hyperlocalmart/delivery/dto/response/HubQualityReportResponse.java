package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class HubQualityReportResponse {

    private UUID hubId;
    private UUID townId;
    private LocalDate from;
    private LocalDate to;
    private long ordersCancelled;
    private long shopBagsPlaced;
    private long shopBagsRejected;
    private double rejectRatePercent;
    @Builder.Default
    private List<ReasonCount> cancelReasons = new ArrayList<>();

    @Data
    @Builder
    public static class ReasonCount {
        private String reason;
        private long count;
    }
}
