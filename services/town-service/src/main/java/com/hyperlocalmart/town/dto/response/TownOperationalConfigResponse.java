package com.hyperlocalmart.town.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
@Builder
public class TownOperationalConfigResponse {

    private BigDecimal minOrderValue;

    /** DEFAULT = platform flat fee; SLAB = order-value slabs for this town. */
    @Builder.Default
    private String deliveryMode = "DEFAULT";

    @Builder.Default
    private List<DeliverySlabResponse> deliverySlabs = new ArrayList<>();

    @Data
    @Builder
    public static class DeliverySlabResponse {
        private BigDecimal minOrderValue;
        /** null = no upper bound */
        private BigDecimal maxOrderValue;
        private BigDecimal deliveryFee;
    }
}
