package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class RecipeSearchResponse {
    private List<RecipeSummaryResponse> items;
}
