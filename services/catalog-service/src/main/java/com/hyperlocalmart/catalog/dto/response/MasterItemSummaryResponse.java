package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class MasterItemSummaryResponse {

    private UUID masterItemId;
    private UUID categoryId;
    private String name;
    private String unit;
    private String category;
    private BigDecimal mrp;
}
