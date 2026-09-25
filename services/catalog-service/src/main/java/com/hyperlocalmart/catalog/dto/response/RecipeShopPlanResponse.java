package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class RecipeShopPlanResponse {
    private UUID id;
    private String name;
    private int servings;
    private List<RecipeShopLineResponse> ingredients;
}
