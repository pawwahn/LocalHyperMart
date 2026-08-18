package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class SetCategoryTownVisibilityRequest {

    /** true = show in these towns; false = hide in these towns. */
    @NotNull
    private Boolean visible;

    @NotEmpty
    @Size(max = 2000)
    private List<UUID> townIds;
}
