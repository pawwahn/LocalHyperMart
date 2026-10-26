package com.hyperlocalmart.town.dto.request;

import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

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

    /** Per vertical scratch rules (GROCERY, LAUNDRY, BEAUTY). Legacy top-level fields still update grocery. */
    private Map<String, Map<String, Object>> scratchByService = new LinkedHashMap<>();

    /** When false, buyers cannot purchase membership while this town is selected. Credits still work. */
    private Boolean buyerMembershipEnabled;

    /** Cash on delivery at checkout for this town. */
    private Boolean codEnabled;

    /** UPI / online pay (Razorpay) at checkout for this town. */
    private Boolean upiEnabled;

    /** Extra COD charge (₹) added to buyer total when paying on delivery. */
    private BigDecimal codCharge;

    /** Inclusive delivery window start, HH:mm in IST. */
    private String deliveryWindowStart;

    /** Inclusive delivery window end, HH:mm in IST. Must be after start. */
    private String deliveryWindowEnd;

    /** Laundry requests can be placed in this town. */
    private Boolean laundryEnabled;

    /** Makeup & beauty bookings can be placed in this town. */
    private Boolean beautyEnabled;

    /** Minimum online prepay (INR) for glam “pay at parlour” bookings. 0 = full payment only. */
    @DecimalMin("0.0")
    private BigDecimal beautyMinPrepayAmount;

    /** Extra INR added to booking total when buyer chooses pay-at-parlour (partial prepay). */
    @DecimalMin("0.0")
    private BigDecimal beautyParlourPaymentFee;

    /** Allow buyers to cancel the entire order (subject to order status). */
    private Boolean buyerCancelOrderEnabled;

    /** Allow buyers to cancel individual items (subject to shop status). */
    private Boolean buyerCancelItemsEnabled;

    @Data
    public static class DeliverySlabRequest {
        private BigDecimal minOrderValue;
        private BigDecimal maxOrderValue;
        private BigDecimal deliveryFee;
    }

    @Data
    public static class ScratchServiceRuleRequest {
        private Boolean enabled;
        private BigDecimal rewardMin;
        private BigDecimal rewardMax;
        /** Order / goods total must be strictly greater than this. */
        private BigDecimal minOrderAmount;
        /** Glam only: BOTH, FULL, or PARTIAL prepay at checkout. */
        private String prepayModeFilter;
        /** Glam: issue scratch card only after buyer rating. Grocery/laundry: false. */
        private Boolean issueAfterRating;
        /** Glam: separate scratch line when buyer prepays partially at booking. */
        private Boolean partialPrepayEnabled;
        private BigDecimal partialRewardMin;
        private BigDecimal partialRewardMax;
        /** Prepay amount must be strictly greater than this. */
        private BigDecimal partialMinPrepayAmount;
        /** Buyer promo label; payout still uses rewardMax. Zero = show rewardMax. */
        private BigDecimal rewardDisplayMax;
        private BigDecimal partialRewardDisplayMax;
    }
}
