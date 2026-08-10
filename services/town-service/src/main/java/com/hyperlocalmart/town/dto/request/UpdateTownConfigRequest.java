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

    @Data
    public static class DeliverySlabRequest {
        private BigDecimal minOrderValue;
        private BigDecimal maxOrderValue;
        private BigDecimal deliveryFee;
    }
}
