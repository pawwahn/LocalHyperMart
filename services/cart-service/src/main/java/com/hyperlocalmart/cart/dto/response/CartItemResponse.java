package com.hyperlocalmart.cart.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class CartItemResponse {

    private UUID itemId;
    private UUID listingId;
    private String name;
    private String shopName;
    private int quantity;
    private BigDecimal unitPrice;
    private BigDecimal lineTotal;
}
