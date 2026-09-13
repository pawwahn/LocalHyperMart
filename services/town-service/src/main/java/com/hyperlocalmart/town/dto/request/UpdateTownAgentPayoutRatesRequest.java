package com.hyperlocalmart.town.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/** Hub/town admin may change agent ₹ amounts only — not models, hub rates, or the permission switch. */
@Data
public class UpdateTownAgentPayoutRatesRequest {

    private PerOrderRates perOrder;
    private PeriodRates perDay;
    private PeriodRates perMonth;
    /** Parallel to existing slab tiers; size must match. */
    private List<BigDecimal> slabAmounts = new ArrayList<>();

    @Data
    public static class PerOrderRates {
        private BigDecimal pickupAmount;
        private BigDecimal lastMileAmount;
        private BigDecimal completedOrderAmount;
    }

    @Data
    public static class PeriodRates {
        private BigDecimal amount;
        private Integer minCompletedOrders;
    }
}
