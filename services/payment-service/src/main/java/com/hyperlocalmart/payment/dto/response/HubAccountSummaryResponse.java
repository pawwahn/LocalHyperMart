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
public class HubAccountSummaryResponse {

    UUID hubId;
    String hubName;
    UUID townId;
    String from;
    String to;

    /** PER_ORDER, FRANCHISE, or BOTH */
    String hubPayoutModel;

    // —— KoyaKart pays hub (delivery commission) ——
    boolean commissionEnabled;
    BigDecimal pickupRate;
    BigDecimal lastMileRate;
    BigDecimal completedOrderRate;
    long deliveredOrdersInRange;
    long payableOrderCount;
    long unpaidOrderCount;
    BigDecimal commissionEarned;
    BigDecimal commissionPaid;
    BigDecimal commissionDue;

    long earnedOrderCount;
    long paidOrderCount;

    @Builder.Default
    List<UnpaidOrder> earnedOrders = new ArrayList<>();

    @Builder.Default
    List<UnpaidOrder> paidOrders = new ArrayList<>();

    @Builder.Default
    List<UnpaidOrder> unpaidOrders = new ArrayList<>();

    @Builder.Default
    List<MoneyMovement> payoutsFromPlatform = new ArrayList<>();

    // —— Hub pays KoyaKart ——
    boolean franchiseEnabled;
    BigDecimal franchiseAmount;
    boolean franchiseCollected;
    boolean franchisePendingVerification;
    String franchiseLabel;

    BigDecimal codStillWithAgents;
    BigDecimal codDeclaredAwaitingConfirm;
    int handoversAwaitingConfirm;

    BigDecimal codConfirmedAtHubAllTime;
    BigDecimal codRemittedToCompanyAllTime;
    /** Cash hub collected from agents minus remitted to company — must pay KoyaKart. */
    BigDecimal codOwedToCompany;
    boolean codPendingVerification;

    @Builder.Default
    List<MoneyMovement> collectionsByPlatform = new ArrayList<>();

    boolean hasPendingPaymentSubmission;
    String pendingPaymentStatusLabel;
    BigDecimal pendingPaymentTotal;
    /** Sum of COD + franchise still payable (excludes items already in a pending submission). */
    BigDecimal payableToPlatformNow;

    @Builder.Default
    List<HubPlatformPaymentSubmissionResponse> recentPaymentSubmissions = new ArrayList<>();

    @Value
    @Builder
    public static class UnpaidOrder {
        UUID orderId;
        String orderNumber;
        Instant deliveredAt;
        BigDecimal amount;
        boolean pickupCompleted;
        boolean lastMileCompleted;
        boolean settled;
        String reference;
        Instant paidAt;
    }

    @Value
    @Builder
    public static class MoneyMovement {
        UUID settlementId;
        String kind;
        String status;
        String periodStart;
        String periodEnd;
        BigDecimal amount;
        String reference;
        Instant recordedAt;
        int orderCount;
    }
}
