package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class MoneyAssuranceReportResponse {
    LocalDate from;
    LocalDate to;
    UUID townId;

    long unpaidPayouts;
    BigDecimal unpaidPayoutAmount;
    List<AgingBucket> aging;
    List<UnpaidLine> oldestUnpaid;

    BigDecimal walletLiability;
    long walletsWithBalance;
    BigDecimal walletCreditsInRange;
    long walletCreditCount;
    BigDecimal walletDebitsInRange;
    long walletDebitCount;
    BigDecimal walletScratch;
    BigDecimal walletReferral;
    BigDecimal walletStoreCredit;
    List<NamedAmount> walletCreditsByReason;

    @Value
    @Builder
    public static class NamedAmount {
        String name;
        long count;
        BigDecimal amount;
    }

    @Value
    @Builder
    public static class AgingBucket {
        String label;
        long count;
        BigDecimal amount;
    }

    @Value
    @Builder
    public static class UnpaidLine {
        UUID settlementId;
        String payeeType;
        String payeeName;
        String status;
        int ageDays;
        BigDecimal netAmount;
        LocalDate periodEnd;
    }
}
