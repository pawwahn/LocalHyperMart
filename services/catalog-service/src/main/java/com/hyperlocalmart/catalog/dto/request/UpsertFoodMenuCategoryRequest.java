package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpsertFoodMenuCategoryRequest {

    @NotBlank
    @Size(max = 120)
    private String name;

    private Integer sortOrder;

    private Boolean active;
}