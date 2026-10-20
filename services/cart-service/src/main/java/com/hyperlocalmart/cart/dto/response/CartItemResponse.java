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
    private String unitCode;
    private int quantity;
    private BigDecimal unitPrice;
    private BigDecimal lineTotal;
    private String imageUrl;
    /** False only when this shop's listing is confirmed gone. Null/true means it can still be ordered. */
    private Boolean available;
    private UUID alternateListingId;
    private String alternateShopName;
    private BigDecimal alternateUnitPrice;
}
