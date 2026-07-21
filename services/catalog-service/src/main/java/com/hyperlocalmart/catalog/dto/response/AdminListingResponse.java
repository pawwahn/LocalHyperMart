package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class AdminListingResponse {

    private UUID listingId;
    private UUID townId;
    private UUID vendorId;
    private UUID shopId;
    private String shopName;
    private UUID masterItemId;
    private String itemName;
    private String category;
    private String unit;
    private BigDecimal mrp;
    private BigDecimal price;
    private BigDecimal discountPrice;
    private BigDecimal effectivePrice;
    private String vendorNote;
    private boolean active;
}
