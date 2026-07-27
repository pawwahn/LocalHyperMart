package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CodCandidateResponse {
    UUID townId;
    UUID hubId;
    UUID agentId;
    String date;
    boolean agentFilterApplied;
    List<Item> items;

    @Value
    @Builder
    public static class Item {
        UUID orderId;
        String orderNumber;
        BigDecimal amount;
        Instant deliveredAt;
        boolean alreadyClosed;
    }
}
