package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Pending hub/vendor COD grouped by IST calendar day, with agent and order rows. */
@Value
@Builder
public class CodCustodianPendingDetailResponse {
    String lookbackFrom;
    String lookbackTo;
    UUID townId;
    UUID hubId;
    UUID vendorId;
    BigDecimal totalStillWithAgents;
    int ordersStillWithAgents;
    BigDecimal totalDeclaredAwaitingConfirm;
    int handoversAwaitingConfirm;
    List<DayBucket> days;
    List<DeclaredHandoverRow> declaredAwaitingHandovers;

    @Value
    @Builder
    public static class DayBucket {
        /** IST delivery or handover date (YYYY-MM-DD). */
        String date;
        BigDecimal stillWithAgentsAmount;
        int stillWithAgentsOrderCount;
        BigDecimal declaredAwaitingAmount;
        int declaredAwaitingOrderCount;
        List<AgentBucket> agents;
    }

    @Value
    @Builder
    public static class AgentBucket {
        UUID agentId;
        String agentName;
        String agentPhone;
        BigDecimal stillWithAgentAmount;
        int stillWithAgentOrderCount;
        BigDecimal declaredAwaitingAmount;
        int declaredAwaitingOrderCount;
        List<OrderRow> stillWithAgentOrders;
        List<DeclaredHandoverRow> declaredAwaiting;
    }

    @Value
    @Builder
    public static class OrderRow {
        UUID orderId;
        String orderNumber;
        BigDecimal collectAmount;
        Instant deliveredAt;
    }

    @Value
    @Builder
    public static class DeclaredHandoverRow {
        UUID handoverId;
        UUID agentId;
        String agentName;
        String agentPhone;
        String handoverDate;
        BigDecimal declaredAmount;
        List<OrderRow> lines;
    }
}
