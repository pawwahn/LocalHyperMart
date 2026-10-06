package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class PlatformReportResponse {
    LocalDate from;
    LocalDate to;
    UUID townId;

    long ordersPlaced;
    long ordersDelivered;
    long ordersCancelled;
    long bagsRejected;
    long uniqueBuyers;

    BigDecimal placedGmv;
    BigDecimal deliveredGmv;
    BigDecimal cancelledGmv;
    BigDecimal codGmv;
    BigDecimal onlineGmv;
    BigDecimal platformFees;
    /** Sum of delivery fee line on delivered orders (₹0 when membership waived delivery). */
    BigDecimal deliveryFeesCollected;
    BigDecimal promoDiscounts;
    BigDecimal averageOrderValue;

    double deliveryRate;
    double cancelRate;
    double rejectRate;
    Double avgReadyMinutes;
    Double avgDeliveryMinutes;

    long membershipDeliveriesWaived;
    BigDecimal membershipFeeWaived;

    List<NamedCount> statusMix;
    List<NamedCount> paymentMix;
    List<DailyRow> daily;
    List<TownRow> towns;
    List<VendorRow> vendors;
    List<NamedCount> cancelReasons;

    @Value
    @Builder
    public static class NamedCount {
        String name;
        long count;
        BigDecimal amount;
    }

    @Value
    @Builder
    public static class DailyRow {
        LocalDate date;
        long orders;
        long delivered;
        long cancelled;
        BigDecimal gmv;
    }

    @Value
    @Builder
    public static class TownRow {
        UUID townId;
        String townName;
        long orders;
        long delivered;
        long cancelled;
        BigDecimal placedGmv;
        BigDecimal deliveredGmv;
        BigDecimal codGmv;
    }

    @Value
    @Builder
    public static class VendorRow {
        UUID vendorId;
        String shopName;
        long bags;
        long ready;
        long rejected;
        BigDecimal sales;
    }
}
