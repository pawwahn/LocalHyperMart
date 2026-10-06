package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class HubTownQualityReportResponse {

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
