package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class AgentPaySummaryResponse {

    UUID agentId;
    String agentName;
    UUID townId;
    String from;
    String to;

    boolean payEnabled;
    /** HUB_NETWORK or VENDOR_SHOP */
    String payModel;
    BigDecimal pickupRate;
    BigDecimal lastMileRate;
    BigDecimal completedOrderRate;
    /** Per delivered order for vendor shop agents (town x). */
    BigDecimal vendorDirectOrderRate;

    long payableOrders;
    /** Deliveries completed by this agent in range (including when town pay is off or rate is ₹0). */
    long yourDeliveries;
    long unpaidOrderCount;
    BigDecimal earned;
    BigDecimal paid;
    BigDecimal due;

    @Builder.Default
    List<UnpaidOrder> unpaidOrders = new ArrayList<>();
    @Builder.Default
    List<Payout> payouts = new ArrayList<>();

    @Value
    @Builder
    public static class UnpaidOrder {
        UUID orderId;
        String orderNumber;
        Instant deliveredAt;
        BigDecimal amount;
        boolean pickupCompleted;
        boolean lastMileCompleted;
    }

    @Value
    @Builder
    public static class Payout {
        UUID settlementId;
        String status;
        String periodStart;
        String periodEnd;
        BigDecimal netAmount;
        String payoutMethod;
        String transactionReference;
        Instant paidAt;
        int orderCount;
    }
}
