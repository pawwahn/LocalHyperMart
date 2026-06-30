package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class VendorListingResponse {

    private UUID listingId;
    private UUID masterItemId;
    private String name;
    private String unit;
    private UUID townId;
    private UUID vendorId;
    private UUID shopId;
    private String shopName;
    private BigDecimal price;
    private BigDecimal discountPrice;
    private String vendorNote;
    private boolean active;
}
