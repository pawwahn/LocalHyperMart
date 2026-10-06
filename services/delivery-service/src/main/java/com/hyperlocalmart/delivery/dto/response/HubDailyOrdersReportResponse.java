package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class HubDailyOrdersReportResponse {

    private UUID hubId;
    private UUID townId;
    private LocalDate from;
    private LocalDate to;
    private List<DailyRow> days;

    @Data
    @Builder
    public static class DailyRow {
        private LocalDate date;
        private long ordersPlaced;
        private long ordersDelivered;
        private long ordersCancelled;
        private BigDecimal deliveredGmv;
        private BigDecimal codDeliveredGmv;
    }
}
