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
public class DeliverySettlementCandidateView {

    UUID townId;
    UUID payeeId;
    String payeeType;
    String from;
    String to;
    String hubPayoutModel;
    FranchiseDue franchise;
    @Builder.Default
    List<Item> items = new ArrayList<>();

    @Value
    @Builder
    public static class FranchiseDue {
        boolean enabled;
        String cadence;
        BigDecimal amount;
        String periodStart;
        String periodEnd;
        boolean alreadyCollected;
        String label;
    }

    @Value
    @Builder
    public static class Item {
        UUID orderId;
        String orderNumber;
        Instant deliveredAt;
        String paymentStatus;
        boolean lastMileCompleted;
        boolean pickupCompleted;
        BigDecimal amount;
        boolean alreadySettled;
        String skipReason;
    }
}
