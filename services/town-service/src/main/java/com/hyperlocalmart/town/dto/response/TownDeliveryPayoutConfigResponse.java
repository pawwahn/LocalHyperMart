package com.hyperlocalmart.town.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TownDeliveryPayoutConfigResponse {

    /** Super admin switch: hub (town) admin may edit agent ₹ amounts. */
    @Builder.Default
    private boolean townAdminCanEditAgentRates = false;

    /** Computed for the caller. Super admin always true; hub admin only when the switch is on. */
    @Builder.Default
    private boolean canEditAgentRates = false;

    @Builder.Default
    private boolean canEditHubRates = false;

    @Builder.Default
    private boolean canEditStructure = false;

    private PayoutPartyConfig agent;
    private PayoutPartyConfig hub;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PayoutPartyConfig {
        @Builder.Default
        private boolean enabled = true;
        @Builder.Default
        private PerOrderIncentive perOrder = new PerOrderIncentive();
        @Builder.Default
        private PeriodIncentive perDay = new PeriodIncentive();
        @Builder.Default
        private PeriodIncentive perMonth = new PeriodIncentive();
        @Builder.Default
        private VolumeSlabIncentive slabs = new VolumeSlabIncentive();
        /** Hub pays the platform (franchise). Ignored on agent. */
        @Builder.Default
        private FranchiseTerms franchise = new FranchiseTerms();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FranchiseTerms {
        @Builder.Default
        private boolean enabled = false;
        /** MONTHLY, QUARTERLY, YEARLY, LIFETIME */
        @Builder.Default
        private String cadence = "MONTHLY";
        /** Amount the hub pays KoyaKart for that cadence. */
        @Builder.Default
        private BigDecimal amount = BigDecimal.ZERO;
        /** First calendar day (YYYY-MM-DD, IST) when franchise billing applies. */
        private String effectiveFrom;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PerOrderIncentive {
        @Builder.Default
        private boolean enabled = true;
        /** Shop → hub pickup trip. */
        @Builder.Default
        private BigDecimal pickupAmount = BigDecimal.ZERO;
        /** Hub → home last-mile trip. */
        @Builder.Default
        private BigDecimal lastMileAmount = BigDecimal.ZERO;
        /** Once when the customer order is delivered. */
        @Builder.Default
        private BigDecimal completedOrderAmount = BigDecimal.ZERO;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PeriodIncentive {
        @Builder.Default
        private boolean enabled = false;
        @Builder.Default
        private BigDecimal amount = BigDecimal.ZERO;
        /** 0 = pay even with zero deliveries that period. */
        @Builder.Default
        private int minCompletedOrders = 0;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VolumeSlabIncentive {
        @Builder.Default
        private boolean enabled = false;
        /** DAY or MONTH */
        @Builder.Default
        private String period = "MONTH";
        /** COMPLETED_ORDERS, LAST_MILE, ALL_TRIPS */
        @Builder.Default
        private String metric = "COMPLETED_ORDERS";
        /** PER_UNIT (₹ × count in slab) or FLAT_BONUS (one amount if count is in slab) */
        @Builder.Default
        private String payout = "PER_UNIT";
        @Builder.Default
        private List<VolumeSlabTier> tiers = new ArrayList<>();
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class VolumeSlabTier {
        @Builder.Default
        private int minCount = 1;
        /** null = and above */
        private Integer maxCount;
        @Builder.Default
        private BigDecimal amount = BigDecimal.ZERO;
    }
}
