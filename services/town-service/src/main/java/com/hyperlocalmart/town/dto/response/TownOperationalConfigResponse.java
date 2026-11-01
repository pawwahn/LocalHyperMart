package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Data
@Builder
public class TownOperationalConfigResponse {

    private BigDecimal minOrderValue;

    /** DEFAULT = platform flat fee; SLAB = order-value slabs for this town. */
    @Builder.Default
    private String deliveryMode = "DEFAULT";

    @Builder.Default
    private List<DeliverySlabResponse> deliverySlabs = new ArrayList<>();

    /** Buyer deals chrome (See all rail, price tiles). Default HLM green. */
    @Builder.Default
    private String themeColor = "#009111";

    /** When false, hide Best deals on the buyer cart. */
    @Builder.Default
    private boolean bestDealsEnabled = true;

    /** Four “Deals at ₹” price points for the buyer See-all rail. */
    @Builder.Default
    private List<Integer> dealPrices = new ArrayList<>(List.of(19, 29, 49, 99));

    /** Buyer basket line below delivery fee. Default ₹0. */
    @Builder.Default
    private BigDecimal platformFee = BigDecimal.ZERO;

    @Builder.Default
    private boolean scratchCardEnabled = false;

    @Builder.Default
    private BigDecimal scratchRewardMin = new BigDecimal("10.00");

    @Builder.Default
    private BigDecimal scratchRewardMax = new BigDecimal("50.00");

    /** Goods total after coupon must be greater than this. */
    @Builder.Default
    private BigDecimal scratchMinGoodsAmount = new BigDecimal("499.00");

    @Builder.Default
    private Map<String, ScratchServiceRuleResponse> scratchByService = new LinkedHashMap<>();

    /** Sell membership in this town. Existing members can still use credits when false. */
    @Builder.Default
    private boolean buyerMembershipEnabled = true;

    @Builder.Default
    private boolean codEnabled = true;

    @Builder.Default
    private boolean upiEnabled = true;

    @Builder.Default
    private BigDecimal codCharge = BigDecimal.ZERO;

    @Builder.Default
    private String deliveryWindowStart = "17:00";

    @Builder.Default
    private String deliveryWindowEnd = "19:00";

    /** Off until super admin turns laundry on for this town. */
    @Builder.Default
    private boolean laundryEnabled = false;

    /** Makeup & beauty bookings in this town. */
    @Builder.Default
    private boolean beautyEnabled = false;

    @Builder.Default
    private BigDecimal beautyMinPrepayAmount = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal beautyParlourPaymentFee = BigDecimal.ZERO;

    /** Buyer can cancel the whole order (when status rules allow). */
    @Builder.Default
    private boolean buyerCancelOrderEnabled = true;

    /** Buyer can cancel individual line items still at PLACED shops. */
    @Builder.Default
    private boolean buyerCancelItemsEnabled = true;

    @Data
    @Builder
    public static class DeliverySlabResponse {
        private BigDecimal minOrderValue;
        /** null = no upper bound */
        private BigDecimal maxOrderValue;
        private BigDecimal deliveryFee;
    }

    @Data
    @Builder
    public static class ScratchServiceRuleResponse {
        private boolean enabled;
        private BigDecimal rewardMin;
        private BigDecimal rewardMax;
        private BigDecimal minOrderAmount;
        private String prepayModeFilter;
        private boolean issueAfterRating;
        private boolean partialPrepayEnabled;
        private BigDecimal partialRewardMin;
        private BigDecimal partialRewardMax;
        private BigDecimal partialMinPrepayAmount;
        private BigDecimal rewardDisplayMax;
        private BigDecimal partialRewardDisplayMax;
    }
}
