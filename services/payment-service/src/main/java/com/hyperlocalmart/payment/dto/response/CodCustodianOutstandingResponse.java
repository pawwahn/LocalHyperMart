package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/** All-dates rollup (IST lookback window) for cash still to collect from shop agents. */
@Value
@Builder
public class CodCustodianOutstandingResponse {
    String lookbackFrom;
    String lookbackTo;
    UUID townId;
    UUID vendorId;
    UUID hubId;
    BigDecimal totalStillWithAgents;
    int ordersStillWithAgents;
    BigDecimal totalDeclaredAwaitingConfirm;
    int handoversAwaitingConfirm;
    List<AgentOutstanding> agents;

    @Value
    @Builder
    public static class AgentOutstanding {
        UUID agentId;
        String agentName;
        BigDecimal stillWithAgentAmount;
        int stillWithAgentOrderCount;
        BigDecimal declaredAwaitingAmount;
        int declaredAwaitingOrderCount;
    }
}
