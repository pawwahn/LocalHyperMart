package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BulkCategoryVisibilityResponse {

    private boolean paused;
    private int updatedCount;
}
