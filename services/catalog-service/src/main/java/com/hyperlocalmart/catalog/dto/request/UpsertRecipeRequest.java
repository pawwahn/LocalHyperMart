package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class UpsertRecipeRequest {

    @NotBlank
    @Size(max = 160)
    private String name;

    @Size(max = 500)
    private String searchText;

    @Min(1)
    @Max(24)
    private int servings = 4;

    private boolean enabled = true;

    @NotEmpty
    @Valid
    private List<RecipeIngredientInput> ingredients;
}
