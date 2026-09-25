package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class AdminRecipeDetailResponse {
    private UUID id;
    private String name;
    private String searchText;
    private int servings;
    private boolean enabled;
    private List<AdminRecipeIngredientResponse> ingredients;
    private Instant createdAt;
    private Instant updatedAt;
}
