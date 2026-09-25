package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class RecipeShopLineResponse {

    private UUID masterItemId;
    private String masterItemName;
    private String quantityLabel;
    private UUID listingId;
    private String shopName;
    private BigDecimal effectivePrice;
    private String imageUrl;
    private boolean available;
}
