package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class AdminRecipeIngredientResponse {
    private UUID id;
    private UUID masterItemId;
    private String masterItemName;
    private String quantityLabel;
    private int sortOrder;
}
