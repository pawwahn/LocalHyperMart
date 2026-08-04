package com.hyperlocalmart.payment.dto.response;

import com.hyperlocalmart.payment.entity.SettlementPayeeType;
import com.hyperlocalmart.payment.entity.SettlementPeriodType;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class SettlementResponse {
    UUID id;
    UUID townId;
    SettlementPayeeType payeeType;
    UUID payeeId;
    String payeeName;
    LocalDate periodStart;
    LocalDate periodEnd;
    SettlementPeriodType periodType;
    BigDecimal grossAmount;
    BigDecimal commissionAmount;
    /** Claim chargebacks deducted from this payout (gross − commission − net). */
    BigDecimal claimChargebacksAmount;
    BigDecimal netAmount;
    SettlementStatus status;
    String payoutMethod;
    String transactionReference;
    String transactionNotes;
    Instant paidAt;
    UUID paidBy;
    Instant createdAt;
    List<Line> lines;

    @Value
    @Builder
    public static class Line {
        UUID id;
        UUID orderId;
        UUID subOrderId;
        String orderNumber;
        String subOrderNumber;
        String lineType;
        BigDecimal amount;
        String description;
    }
}
