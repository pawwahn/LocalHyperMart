package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Value
@Builder
public class MembershipReportResponse {
    LocalDate from;
    LocalDate to;
    long activeMembers;
    long expiringIn7Days;
    long usableCreditsOutstanding;
    long packsSold;
    long gifts;
    long cashPending;
    BigDecimal paidRevenue;
    long creditsGranted;
    long deliveriesWaived;
    long creditsRestored;
    BigDecimal deliveryFeeWaived;
    List<NamedCount> slabMix;
    List<NamedCount> channelMix;

    @Value
    @Builder
    public static class NamedCount {
        String name;
        long count;
        BigDecimal amount;
    }
}
