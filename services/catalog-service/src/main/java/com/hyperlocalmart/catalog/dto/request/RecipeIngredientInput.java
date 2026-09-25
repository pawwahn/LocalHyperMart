package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class RecipeIngredientInput {

    @NotNull
    private UUID masterItemId;

    @NotBlank
    @Size(max = 80)
    private String quantityLabel;

    private Short sortOrder;
}
