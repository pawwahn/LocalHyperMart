package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class RecipeSummaryResponse {
    private UUID id;
    private String name;
    private int servings;
}
