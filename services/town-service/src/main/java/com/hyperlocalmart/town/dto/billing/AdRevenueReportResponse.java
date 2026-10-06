package com.hyperlocalmart.town.dto.billing;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class AdRevenueReportResponse {
    LocalDate from;
    LocalDate to;
    UUID townId;
    long invoiceCount;
    long paidCount;
    long issuedCount;
    long voidCount;
    BigDecimal billed;
    BigDecimal collected;
    BigDecimal outstanding;
    BigDecimal taxCollected;
    List<NamedAmount> bySlot;
    List<NamedAmount> byStatus;

    @Value
    @Builder
    public static class NamedAmount {
        String name;
        long count;
        BigDecimal amount;
    }
}
