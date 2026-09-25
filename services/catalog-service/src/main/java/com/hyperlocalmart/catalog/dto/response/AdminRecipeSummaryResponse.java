package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class AdminRecipeSummaryResponse {
    private UUID id;
    private String name;
    private int servings;
    private boolean enabled;
    private long ingredientCount;
    private Instant updatedAt;
}
