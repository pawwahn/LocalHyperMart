package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CodDeliveredResponse {
    UUID townId;
    UUID agentId;
    String date;
    /**
     * Gate A limitation: when agentId is set but no LAST_MILE assignment data is available
     * from delivery-service, items are town-level COD delivered for the day (not agent-filtered).
     */
    boolean agentFilterApplied;
    List<Item> items;

    @Value
    @Builder
    public static class Item {
        UUID orderId;
        String orderNumber;
        BigDecimal totalAmount;
        Instant deliveredAt;
    }
}
