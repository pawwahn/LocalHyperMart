package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class OpsAssuranceReportResponse {
    LocalDate from;
    LocalDate to;
    UUID townId;

    List<HsnGstRow> gstByHsn;
    BigDecimal gstTaxable;
    BigDecimal gstCgst;
    BigDecimal gstSgst;
    BigDecimal gstIgst;
    BigDecimal gstCess;
    BigDecimal gstTotal;

    long claimsOpened;
    long claimsOpen;
    long claimsResolved;
    long claimsRejected;
    BigDecimal claimsCredited;
    List<NamedAmount> claimsByType;
    List<NamedAmount> claimsByTown;

    long ordersPlaced;
    long deliveredOnTime;
    long deliveredLate;
    long stillOpen;
    long openOverdue;
    long cancelled;
    Double lateDeliveryRate;
    Double avgDeliveryMinutes;

    @Value
    @Builder
    public static class HsnGstRow {
        String hsn;
        BigDecimal gstPercent;
        long lines;
        BigDecimal taxable;
        BigDecimal cgst;
        BigDecimal sgst;
        BigDecimal igst;
        BigDecimal cess;
        BigDecimal amount;
    }

    @Value
    @Builder
    public static class NamedAmount {
        String name;
        long count;
        BigDecimal amount;
    }
}
