package com.hyperlocalmart.delivery.client;

import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class OrderDeliveryManifestDto {
    private UUID orderId;
    private String orderNumber;
    private BigDecimal subtotal;
    private int totalItemCount;
    private List<Line> items;

    @Data
    public static class Line {
        private String shopName;
        private String name;
        private int quantity;
        private String unitCode;
        private BigDecimal lineTotal;
    }
}
