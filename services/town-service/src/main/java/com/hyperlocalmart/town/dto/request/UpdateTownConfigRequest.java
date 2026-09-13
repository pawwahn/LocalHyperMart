package com.hyperlocalmart.town.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class UpdateTownConfigRequest {

    private BigDecimal minOrderValue;

    /** DEFAULT or SLAB */
    private String deliveryMode;

    private List<DeliverySlabRequest> deliverySlabs = new ArrayList<>();

    /** Hex #RRGGBB used on buyer Best deals chrome. */
    private String themeColor;

    private Boolean bestDealsEnabled;

    /** Four whole-rupee deal price points shown as “Deals at ₹”. */
    private List<Integer> dealPrices;

    /** Convenience / platform fee added on the buyer basket below delivery. */
    private BigDecimal platformFee;

    private Boolean scratchCardEnabled;

    /** Wallet credit lower bound (₹) when the card is scratched. */
    private BigDecimal scratchRewardMin;

    /** Wallet credit upper bound (₹) when the card is scratched. */
    private BigDecimal scratchRewardMax;

    /** Goods total after coupon must be greater than this (excludes delivery + platform). */
    private BigDecimal scratchMinGoodsAmount;

    /** When false, buyers cannot purchase membership while this town is selected. Credits still work. */
    private Boolean buyerMembershipEnabled;

    @Data
    public static class DeliverySlabRequest {
        private BigDecimal minOrderValue;
        private BigDecimal maxOrderValue;
        private BigDecimal deliveryFee;
    }
}
