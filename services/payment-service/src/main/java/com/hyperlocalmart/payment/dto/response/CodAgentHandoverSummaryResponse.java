package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CodAgentHandoverSummaryResponse {
    String handoverDate;
    UUID agentId;
    BigDecimal pendingCollectTotal;
    BigDecimal pendingHubTotal;
    BigDecimal pendingVendorTotal;
    int pendingOrderCount;
    List<OrderRow> orders;
    List<CodAgentHandoverResponse> handovers;

    @Value
    @Builder
    public static class OrderRow {
        UUID orderId;
        String orderNumber;
        BigDecimal collectAmount;
        Instant deliveredAt;
        /** PENDING | SUBMITTED */
        String remittanceStatus;
        /** HUB | VENDOR — who must receive this cash */
        String custodianType;
    }
}
