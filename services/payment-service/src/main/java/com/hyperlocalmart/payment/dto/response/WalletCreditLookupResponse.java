package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Value
@Builder
public class WalletCreditLookupResponse {
    List<Item> items;

    @Value
    @Builder
    public static class Item {
        UUID referenceId;
        String referenceType;
        BigDecimal amount;
    }
}
