package com.hyperlocalmart.payment.dto.response;

import com.hyperlocalmart.payment.entity.SettlementDirection;
import com.hyperlocalmart.payment.entity.SettlementStatus;
import lombok.Builder;
import lombok.Value;

import java.util.List;
import java.util.UUID;

@Value
@Builder
public class AdminOrderSettlementResponse {
    List<Item> items;

    @Value
    @Builder
    public static class Item {
        UUID orderId;
        SettlementDirection direction;
        SettlementStatus status;
        boolean paid;
    }
}
