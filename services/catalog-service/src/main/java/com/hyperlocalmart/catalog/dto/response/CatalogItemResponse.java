package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class CatalogItemResponse {

    private UUID listingId;
    private UUID masterItemId;
    private String name;
    private String unit;
    private String shopName;
    private UUID vendorId;
    private BigDecimal price;
    private BigDecimal discountPrice;
    private String imageUrl;
}
