package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class CodHubLedgerResponse {
    UUID townId;
    UUID hubId;
    String from;
    String to;

    /** Cash confirmed received from agents (hub-route COD), all time. */
    BigDecimal totalReceivedAllTime;
    /** Recorded payments from hub to company (platform), all time. */
    BigDecimal totalRemittedAllTime;
    /** totalReceivedAllTime − totalRemittedAllTime — hub must remit this to company. */
    BigDecimal balanceOwedToCompany;

    BigDecimal totalReceivedInRange;
    BigDecimal totalRemittedInRange;

    List<ReceiptRow> receipts;
    List<RemittanceRow> remittances;

    @Value
    @Builder
    public static class ReceiptRow {
        UUID closeDayId;
        UUID agentId;
        String agentName;
        String closeDate;
        BigDecimal receivedAmount;
        int orderCount;
        String status;
        Instant confirmedAt;
        boolean fromAgentHandover;
    }

    @Value
    @Builder
    public static class RemittanceRow {
        UUID remittanceId;
        String remittanceDate;
        BigDecimal amount;
        String reference;
        String notes;
        Instant recordedAt;
    }
}
