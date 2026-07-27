package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class CreateMasterItemRequest {

    @NotNull
    private UUID categoryId;

    @NotNull
    private UUID unitId;

    @NotBlank
    @Size(max = 200)
    private String name;

    @Size(max = 1000)
    private String description;

    @DecimalMin("0.01")
    private BigDecimal mrp;
}
