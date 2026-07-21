package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class ListingSnapshotResponse {

    private UUID listingId;
    private UUID townId;
    private UUID vendorId;
    private UUID shopId;
    private UUID masterItemId;
    private String name;
    private String unit;
    private BigDecimal price;
    private BigDecimal discountPrice;
    private BigDecimal effectivePrice;
    private boolean active;
}
