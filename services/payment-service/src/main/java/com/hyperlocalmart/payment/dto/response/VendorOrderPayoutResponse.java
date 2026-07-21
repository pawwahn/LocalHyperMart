package com.hyperlocalmart.payment.dto.response;

import com.hyperlocalmart.payment.entity.SettlementStatus;
import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class VendorOrderPayoutResponse {
    List<Item> items;

    @Value
    @Builder
    public static class Item {
        UUID subOrderId;
        UUID orderId;
        String orderNumber;
        String subOrderNumber;
        BigDecimal amount;
        boolean paid;
        SettlementStatus settlementStatus;
        UUID settlementId;
        Instant paidAt;
        String payoutMethod;
        String transactionReference;
        String transactionNotes;
        String periodStart;
        String periodEnd;
    }
}
