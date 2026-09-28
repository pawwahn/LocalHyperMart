package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class MasterItemSummaryResponse {

    private UUID masterItemId;
    private UUID categoryId;
    private UUID unitId;
    private String name;
    /** Alternate names for search. Not shown on the buyer product card. */
    private String searchNames;
    private String unit;
    private String category;
    private BigDecimal mrp;
    private String hsnCode;
    private BigDecimal gstPercent;
    private BigDecimal cessPercent;
    private Boolean priceIncludesTax;
    private String countryOfOrigin;
    /** Ordered public URLs (max 3) from admin uploads. */
    private List<String> imageUrls;
}
