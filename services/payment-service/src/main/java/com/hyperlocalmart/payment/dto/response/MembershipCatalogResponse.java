package com.hyperlocalmart.payment.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;
import java.util.List;

@Value
@Builder
public class MembershipCatalogResponse {
    boolean platformEnabled;
    boolean townSells;
    boolean canPurchase;
    String blockReason;
    MembershipMeResponse mine;
    List<SlabOffer> slabs;

    @Value
    @Builder
    public static class SlabOffer {
        String code;
        String label;
        int months;
        BigDecimal price;
        int credits;
        boolean purchasable;
    }
}
