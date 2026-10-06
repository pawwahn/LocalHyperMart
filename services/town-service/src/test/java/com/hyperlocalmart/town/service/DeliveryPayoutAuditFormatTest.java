package com.hyperlocalmart.town.service;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class DeliveryPayoutAuditFormatTest {

    @Test
    void emitsFieldLevelOldNewForAgentMoney() {
        Map<String, Object> before = Map.of(
                "townAdminCanEditAgentRates", false,
                "agent", party(Map.of("pickupAmount", BigDecimal.ZERO)),
                "hub", party(Map.of()));
        Map<String, Object> after = Map.of(
                "townAdminCanEditAgentRates", false,
                "agent", party(Map.of("pickupAmount", new BigDecimal("12.50"))),
                "hub", party(Map.of()));

        List<String> lines = DeliveryPayoutAuditFormat.changeParts(before, after);

        assertThat(lines).contains("Agent · Vendor → hub: ₹0.00 → ₹12.50");
        assertThat(lines).noneMatch(l -> l.contains("changed"));
    }

    private static Map<String, Object> party(Map<String, Object> perOrderOverrides) {
        Map<String, Object> perOrder = new LinkedHashMap<>();
        perOrder.put("enabled", true);
        perOrder.put("pickupAmount", BigDecimal.ZERO);
        perOrder.put("lastMileAmount", BigDecimal.ZERO);
        perOrder.put("completedOrderAmount", BigDecimal.ZERO);
        perOrder.putAll(perOrderOverrides);
        Map<String, Object> party = new LinkedHashMap<>();
        party.put("enabled", true);
        party.put("perOrder", perOrder);
        party.put("perDay", Map.of("enabled", false, "amount", BigDecimal.ZERO, "minCompletedOrders", 0));
        party.put("perMonth", Map.of("enabled", false, "amount", BigDecimal.ZERO, "minCompletedOrders", 0));
        party.put(
                "slabs",
                Map.of(
                        "enabled", false,
                        "period", "MONTH",
                        "metric", "COMPLETED_ORDERS",
                        "payout", "PER_UNIT",
                        "tiers",
                        List.of(Map.of("minCount", 1, "amount", BigDecimal.ZERO))));
        party.put("franchise", Map.of("enabled", false, "cadence", "MONTHLY", "amount", BigDecimal.ZERO));
        return party;
    }
}
