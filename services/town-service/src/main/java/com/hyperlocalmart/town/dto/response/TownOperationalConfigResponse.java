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

    /** Buyer deals chrome (See all rail, price tiles). Default HLM green. */
    @Builder.Default
    private String themeColor = "#0C831F";

    /** When false, hide Best deals on the buyer cart. */
    @Builder.Default
    private boolean bestDealsEnabled = true;

    /** Four “Deals at ₹” price points for the buyer See-all rail. */
    @Builder.Default
    private List<Integer> dealPrices = new ArrayList<>(List.of(19, 29, 49, 99));

    /** Buyer basket line below delivery fee. Default ₹0. */
    @Builder.Default
    private BigDecimal platformFee = BigDecimal.ZERO;

    @Data
    @Builder
    public static class DeliverySlabResponse {
        private BigDecimal minOrderValue;
        /** null = no upper bound */
        private BigDecimal maxOrderValue;
        private BigDecimal deliveryFee;
    }
}
