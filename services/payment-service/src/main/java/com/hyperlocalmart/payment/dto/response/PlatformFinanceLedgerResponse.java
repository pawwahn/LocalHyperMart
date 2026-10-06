package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class PlatformFinanceLedgerResponse {

    private LocalDate from;
    private LocalDate to;
    private UUID townId;
    private String townName;

    private BigDecimal totalInflows;
    private BigDecimal totalOutflows;
    private BigDecimal netCashMovement;
    private BigDecimal passThroughInflows;
    private BigDecimal passThroughOutflows;
    private BigDecimal platformReceipts;

    private int entryCount;
    private boolean truncated;
    private String complianceNote;

    @Builder.Default
    private List<DailySummary> daily = new ArrayList<>();

    @Builder.Default
    private List<LedgerEntry> entries = new ArrayList<>();

    /** Sum of OUT rows tagged OPERATING (e.g. buyer refunds). */
    private BigDecimal operatingOutflows;

    /** Wallet gifts in the period (scratch, referral, store credit) — not a bank movement. */
    private BigDecimal walletGranted;
    /** Wallet spent on orders / reversed — liability released. */
    private BigDecimal walletRedeemed;
    private BigDecimal walletScratch;
    private BigDecimal walletReferral;
    private BigDecimal walletStoreCredit;

    @Builder.Default
    private List<CategoryTotal> categoryTotals = new ArrayList<>();

    /** Populated when no town filter — cash movement by town. */
    @Builder.Default
    private List<TownCashTotal> townCashTotals = new ArrayList<>();

    @Builder.Default
    private List<PartyCashTotal> hubCashTotals = new ArrayList<>();

    @Builder.Default
    private List<PartyCashTotal> vendorCashTotals = new ArrayList<>();

    @Data
    @Builder
    public static class CategoryTotal {
        private String category;
        private String categoryLabel;
        private String direction;
        private String cashNature;
        private int entryCount;
        private BigDecimal amount;
    }

    @Data
    @Builder
    public static class TownCashTotal {
        private UUID townId;
        private BigDecimal inflows;
        private BigDecimal outflows;
        private BigDecimal platformReceipts;
        private BigDecimal passThroughInflows;
        private BigDecimal passThroughOutflows;
    }

    @Data
    @Builder
    public static class PartyCashTotal {
        private UUID partyId;
        private String partyName;
        private BigDecimal inflows;
        private BigDecimal outflows;
        private BigDecimal franchiseFees;
        private BigDecimal codRemittances;
        private BigDecimal otherInflows;
        private BigDecimal payouts;
        private int txnCount;
    }

    @Data
    @Builder
    public static class DailySummary {
        private LocalDate date;
        private BigDecimal inflows;
        private BigDecimal outflows;
        private BigDecimal net;
        private int entries;
    }

    @Data
    @Builder
    public static class LedgerEntry {
        private UUID entryId;
        private String sourceType;
        private LocalDate bookDate;
        private Instant occurredAt;
        /** IN = received by platform bank/gateway; OUT = paid from platform */
        private String direction;
        private String category;
        private String categoryLabel;
        /** OPERATING | PASS_THROUGH */
        private String cashNature;
        private BigDecimal amount;
        private String currency;
        private String counterpartyRole;
        private String counterpartyName;
        private UUID counterpartyId;
        private UUID townId;
        private String paymentRail;
        private String transactionReference;
        private String narrative;
        private String orderNumbers;
        private String periodLabel;
        private UUID settlementId;
        private UUID orderId;
    }
}
