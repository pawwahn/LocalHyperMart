package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CodCustodianReceivableResponse {
    String date;
    UUID townId;
    UUID hubId;
    UUID vendorId;
    BigDecimal totalStillWithAgents;
    int ordersStillWithAgents;
    BigDecimal totalDeclaredAwaitingConfirm;
    int handoversAwaitingConfirm;
    List<AgentReceivable> agents;

    @Value
    @Builder
    public static class AgentReceivable {
        UUID agentId;
        String agentName;
        BigDecimal stillWithAgentAmount;
        int stillWithAgentOrderCount;
        BigDecimal declaredAwaitingAmount;
        int declaredAwaitingOrderCount;
        List<OrderDue> stillWithAgentOrders;
        List<DeclaredHandover> declaredAwaitingConfirm;
    }

    @Value
    @Builder
    public static class OrderDue {
        UUID orderId;
        String orderNumber;
        BigDecimal collectAmount;
        Instant deliveredAt;
    }

    @Value
    @Builder
    public static class DeclaredHandover {
        UUID handoverId;
        BigDecimal declaredAmount;
        List<OrderDue> lines;
    }
}
