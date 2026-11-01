package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class TownShopSettingsResponse {

    @Builder.Default
    private String themeColor = "#009111";

    @Builder.Default
    private boolean bestDealsEnabled = true;

    @Builder.Default
    private List<Integer> dealPrices = new ArrayList<>(List.of(19, 29, 49, 99));

    @Builder.Default
    private BigDecimal platformFee = BigDecimal.ZERO;

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

    @Builder.Default
    private boolean laundryEnabled = false;

    @Builder.Default
    private boolean beautyEnabled = false;

    @Builder.Default
    private BigDecimal beautyMinPrepayAmount = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal beautyParlourPaymentFee = BigDecimal.ZERO;

    /** Glam scratch card (buyer checkout promo). */
    @Builder.Default
    private boolean beautyScratchEnabled = false;

    @Builder.Default
    private String beautyScratchPrepayFilter = "BOTH";

    @Builder.Default
    private BigDecimal beautyScratchRewardMax = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal beautyScratchRewardMin = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal beautyScratchMinOrderAmount = BigDecimal.ZERO;

    @Builder.Default
    private boolean beautyScratchPartialEnabled = false;

    @Builder.Default
    private BigDecimal beautyScratchPartialRewardMax = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal beautyScratchPartialRewardMin = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal beautyScratchPartialMinPrepayAmount = BigDecimal.ZERO;

    /** Buyer checkout promo (may differ from actual scratch rewardMax). */
    @Builder.Default
    private BigDecimal beautyScratchRewardDisplayMax = BigDecimal.ZERO;

    @Builder.Default
    private BigDecimal beautyScratchPartialRewardDisplayMax = BigDecimal.ZERO;
}
