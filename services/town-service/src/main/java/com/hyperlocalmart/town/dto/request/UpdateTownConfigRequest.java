package com.hyperlocalmart.town.dto.request;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class UpdateTownConfigRequest {

    private BigDecimal minOrderValue;

    /** DEFAULT or SLAB */
    private String deliveryMode;

    private List<DeliverySlabRequest> deliverySlabs = new ArrayList<>();

    /** Hex #RRGGBB used on buyer Best deals chrome. */
    private String themeColor;

    private Boolean bestDealsEnabled;

    /** Four whole-rupee deal price points shown as “Deals at ₹”. */
    private List<Integer> dealPrices;

    /** Convenience / platform fee added on the buyer basket below delivery. */
    private BigDecimal platformFee;

    @Data
    public static class DeliverySlabRequest {
        private BigDecimal minOrderValue;
        private BigDecimal maxOrderValue;
        private BigDecimal deliveryFee;
    }
}
