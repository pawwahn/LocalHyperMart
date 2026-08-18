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
    private String unit;
    private String category;
    private BigDecimal mrp;
    /** Ordered public URLs (max 3) from admin uploads. */
    private List<String> imageUrls;
}
