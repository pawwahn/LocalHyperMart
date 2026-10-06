package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Value
@Builder
public class PlatformFinanceAccrualResponse {
    LocalDate from;
    LocalDate to;
    java.util.UUID townId;

    long ordersDelivered;
    BigDecimal deliveredOrderValue;
    BigDecimal platformFeesOnDelivered;
    BigDecimal deliveryFeesOnDelivered;
    BigDecimal codFeesOnDelivered;
    BigDecimal orderLevelTaxAmount;

    BigDecimal itemCgst;
    BigDecimal itemSgst;
    BigDecimal itemIgst;
    BigDecimal itemGstTotal;

    /** platformFees + cod/delivery if treated as platform charges — primary IT “fees” line from orders */
    BigDecimal estimatedPlatformRevenueFromOrders;

    List<DailyAccrualRow> daily;

    @Value
    @Builder
    public static class DailyAccrualRow {
        LocalDate date;
        long ordersDelivered;
        BigDecimal platformFees;
        BigDecimal deliveredGmv;
        BigDecimal gstTotal;
    }
}
