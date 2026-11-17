package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CancellationPenaltyLookupRequest {

    @NotNull
    private List<OrderRef> orders;

    @Data
    public static class OrderRef {
        @NotNull
        private UUID orderId;
        private String orderNumber;
    }
}