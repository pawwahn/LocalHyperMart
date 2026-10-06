package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Value
@Builder
public class HubTownDailyReportStatsResponse {
    LocalDate from;
    LocalDate to;
    List<DailyRow> days;

    @Value
    @Builder
    public static class DailyRow {
        LocalDate date;
        long ordersPlaced;
        long ordersDelivered;
        long ordersCancelled;
        BigDecimal deliveredGmv;
        BigDecimal codDeliveredGmv;
    }
}
