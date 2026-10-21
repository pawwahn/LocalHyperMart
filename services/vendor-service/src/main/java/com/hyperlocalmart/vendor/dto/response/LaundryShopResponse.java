package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class LaundryShopResponse {

    private UUID vendorId;
    private UUID townId;
    private String businessName;
    private String phone;
    private String vendorStatus;
    private boolean enabled;
    private boolean priceEditAllowed;
    private Integer dailyPieceCapacity;
    private String closedWeekdays;
    private BigDecimal pickupCharge;
    private BigDecimal dropCharge;
    private BigDecimal pickupAndDropCharge;

    @Builder.Default
    private List<RateRow> rates = new ArrayList<>();

    @Builder.Default
    private List<RateChange> rateHistory = new ArrayList<>();

    private String feeModel;
    private BigDecimal perPieceAmount;
    private BigDecimal perOrderFlatAmount;
    private BigDecimal monthlySubscriptionAmount;

    @Data
    @Builder
    public static class RateRow {
        private String serviceType;
        private String itemType;
        private BigDecimal unitPrice;
        private boolean paused;
    }

    @Data
    @Builder
    public static class RateChange {
        private String serviceType;
        private String itemType;
        private BigDecimal unitPrice;
        private String changedAt;
    }
}
