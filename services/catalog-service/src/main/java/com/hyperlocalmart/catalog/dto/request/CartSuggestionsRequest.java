package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class CartSuggestionsRequest {

    @NotNull
    private UUID townId;

    /** Listing IDs already in the buyer cart — never suggest these. */
    private List<UUID> excludeListingIds;

    /** Master items currently in the cart — used to resolve related categories. */
    private List<UUID> seedMasterItemIds;

    /** Cart line names — fallback keyword search when category browse is thin. */
    private List<String> seedNames;

    @Min(1)
    @Max(12)
    private Integer limit = 6;
}
