package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Value;

import java.math.BigDecimal;

@Value
@Builder
public class MembershipConfigResponse {
    boolean enabled;
    Slab quarterly;
    Slab halfYear;
    Slab annual;

    @Value
    @Builder
    public static class Slab {
        String code;
        int months;
        BigDecimal price;
        int credits;
    }
}
