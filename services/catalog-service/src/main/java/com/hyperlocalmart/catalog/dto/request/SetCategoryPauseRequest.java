package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class SetCategoryPauseRequest {

    /** true = hidden in all towns (including towns launched later). */
    @NotNull
    private Boolean paused;
}
