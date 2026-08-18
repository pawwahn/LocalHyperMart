package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class CategoryTownVisibilityResponse {

    private UUID categoryId;
    private boolean paused;
    /** Towns hidden while the category is globally live. */
    private List<UUID> hiddenTownIds;
    /** Towns shown while the category is globally paused. */
    private List<UUID> liveTownIds;
}
