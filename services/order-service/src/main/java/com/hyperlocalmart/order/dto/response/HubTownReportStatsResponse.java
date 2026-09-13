package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;

@Value
@Builder
public class HubTownReportStatsResponse {
    LocalDate from;
    LocalDate to;
    long ordersPlaced;
    long ordersDelivered;
    long ordersCancelled;
    long subOrdersPlaced;
    long bagsMarkedReady;
    BigDecimal placedGmv;
    BigDecimal deliveredGmv;
    BigDecimal codGmv;
}
