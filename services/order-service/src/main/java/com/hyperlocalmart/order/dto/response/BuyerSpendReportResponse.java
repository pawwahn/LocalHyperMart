package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class BuyerSpendReportResponse {
    LocalDate from;
    LocalDate to;
    UUID townId;
    long ordersPlaced;
    long ordersDelivered;
    long ordersCancelled;
    BigDecimal spent;
    BigDecimal deliveredSpend;
    BigDecimal codSpend;
    BigDecimal onlineSpend;
    BigDecimal averageOrderValue;
    List<MonthRow> months;

    @Value
    @Builder
    public static class MonthRow {
        String month;
        long orders;
        BigDecimal spent;
    }
}
