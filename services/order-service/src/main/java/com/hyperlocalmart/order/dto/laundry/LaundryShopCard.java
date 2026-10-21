package com.hyperlocalmart.order.dto.laundry;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class LaundryShopCard {

    private UUID vendorId;
    private String businessName;
    private String phone;
    private BigDecimal pickupCharge;
    private BigDecimal dropCharge;
    private BigDecimal pickupAndDropCharge;
    private String feeModel;
    private BigDecimal perPieceAmount;
    private BigDecimal perOrderFlatAmount;

    @Builder.Default
    private List<RateCard> rates = new ArrayList<>();

    @Data
    @Builder
    public static class RateCard {
        private String serviceType;
        private String itemType;
        private BigDecimal unitPrice;
    }
}
