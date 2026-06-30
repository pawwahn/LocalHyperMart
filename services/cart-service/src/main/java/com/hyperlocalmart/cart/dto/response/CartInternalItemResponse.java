package com.hyperlocalmart.cart.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class CartInternalItemResponse {

    private UUID itemId;
    private UUID listingId;
    private UUID vendorId;
    private UUID shopId;
    private UUID masterItemId;
    private String itemName;
    private String shopName;
    private int quantity;
    private BigDecimal unitPrice;
    private BigDecimal discountPrice;
    private BigDecimal lineTotal;
}
