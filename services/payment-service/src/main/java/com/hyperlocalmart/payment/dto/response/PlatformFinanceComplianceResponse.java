package com.hyperlocalmart.payment.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class PlatformFinanceComplianceResponse {

    private LocalDate from;
    private LocalDate to;
    private UUID townId;

    private PlatformFinanceLedgerResponse cashLedger;
    private RevenueAccrual accrual;
    private GstSummary gst;
    private TdsReport tds;
    private GatewayReconciliation gateway;
    /** Not named `management` — avoids collision with Spring Boot actuator config namespace in some proxies. */
    @JsonProperty("managementSummary")
    private ManagementSummary managementSummary;
    private PayoutRegister payoutRegister;
    private RefundRegister refundRegister;

    @Data
    @Builder
    public static class ManagementSummary {
        private BigDecimal estimatedPlatformRevenue;
        private BigDecimal platformCashReceipts;
        private BigDecimal buyerRefunds;
        private BigDecimal paymentGatewayFees;
        private BigDecimal netSurplusBeforeOperatingExpenses;
        private BigDecimal passThroughFloat;
        private BigDecimal netCashMovement;
        private BigDecimal walletGranted;
        private BigDecimal walletScratch;
        private BigDecimal walletReferral;
        private BigDecimal walletStoreCredit;
        /** SURPLUS | SHORTFALL | BREAK_EVEN — accrual revenue minus refunds, gateway fees, and wallet gifts */
        private String platformResultIndicator;
        private String note;
    }

    @Data
    @Builder
    public static class PayoutRegister {
        private BigDecimal vendorPayouts;
        private BigDecimal agentPayouts;
        private BigDecimal hubDeliveryPayouts;
        private BigDecimal franchiseFeesCollected;
        private BigDecimal otherCollectionsFromHubs;
        private BigDecimal vendorFeesCollected;
        @Builder.Default
        private List<PayoutLine> lines = new ArrayList<>();
    }

    @Data
    @Builder
    public static class PayoutLine {
        private UUID settlementId;
        private LocalDate paidDate;
        private String payeeType;
        private String direction;
        private String payeeName;
        private UUID payeeId;
        private UUID townId;
        private BigDecimal grossAmount;
        private BigDecimal commissionAmount;
        private BigDecimal netAmount;
        private String periodLabel;
        private String transactionReference;
        private boolean franchiseFee;
    }

    @Data
    @Builder
    public static class RefundRegister {
        private int refundCount;
        private BigDecimal totalRefunded;
        @Builder.Default
        private List<RefundLine> lines = new ArrayList<>();
    }

    @Data
    @Builder
    public static class RefundLine {
        private UUID refundId;
        private LocalDate refundDate;
        private UUID orderId;
        private UUID paymentId;
        private UUID townId;
        private BigDecimal amount;
        private String reason;
        private String gatewayReference;
    }

    @Data
    @Builder
    public static class RevenueAccrual {
        private long ordersDelivered;
        private BigDecimal deliveredOrderValue;
        private BigDecimal platformFeesOnDelivered;
        private BigDecimal deliveryFeesOnDelivered;
        private BigDecimal codFeesOnDelivered;
        private BigDecimal vendorCommissionEarned;
        private BigDecimal membershipRevenue;
        private BigDecimal totalEstimatedPlatformRevenue;
        private List<DailyAccrual> daily;
    }

    @Data
    @Builder
    public static class DailyAccrual {
        private LocalDate date;
        private long ordersDelivered;
        private BigDecimal platformFees;
        private BigDecimal deliveredGmv;
        private BigDecimal gstTotal;
    }

    @Data
    @Builder
    public static class GstSummary {
        private BigDecimal cgstOnDeliveredItems;
        private BigDecimal sgstOnDeliveredItems;
        private BigDecimal igstOnDeliveredItems;
        private BigDecimal totalGstOnDeliveredItems;
        private BigDecimal orderLevelTaxAmount;
        private String note;
    }

    @Data
    @Builder
    public static class TdsReport {
        private BigDecimal ratePercent;
        private String legalNote;
        private BigDecimal totalGrossSalesFacilitated;
        private BigDecimal totalTdsEstimated;
        private BigDecimal totalNetPaidToVendors;
        private BigDecimal totalPlatformCommission;
        @Builder.Default
        private List<TdsLine> lines = new ArrayList<>();
    }

    @Data
    @Builder
    public static class TdsLine {
        private UUID settlementId;
        private LocalDate paidDate;
        private String vendorName;
        private UUID vendorId;
        private BigDecimal grossSales;
        private BigDecimal platformCommission;
        private BigDecimal netPaid;
        private BigDecimal tdsEstimated;
        private String transactionReference;
    }

    @Data
    @Builder
    public static class GatewayReconciliation {
        private BigDecimal appOnlineCollections;
        private BigDecimal appOnlineRefunds;
        private BigDecimal appNetOnline;
        private BigDecimal importedSettlementGross;
        private BigDecimal importedSettlementFees;
        private BigDecimal importedSettlementNet;
        private BigDecimal varianceAppNetVsBankNet;
        private String note;
        @Builder.Default
        private List<GatewayDayRow> byDay = new ArrayList<>();
        @Builder.Default
        private List<RazorpayBatchRow> batches = new ArrayList<>();
    }

    @Data
    @Builder
    public static class GatewayDayRow {
        private LocalDate date;
        private BigDecimal appCollected;
        private BigDecimal bankSettledNet;
        private BigDecimal variance;
    }

    @Data
    @Builder
    public static class RazorpayBatchRow {
        private UUID id;
        private LocalDate settlementDate;
        private String utrReference;
        private BigDecimal grossAmount;
        private BigDecimal feeAmount;
        private BigDecimal netAmount;
        private Integer paymentCount;
        private String notes;
    }
}
