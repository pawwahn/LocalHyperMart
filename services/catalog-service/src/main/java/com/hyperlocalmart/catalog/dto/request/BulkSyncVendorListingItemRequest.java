package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class BulkSyncVendorListingItemRequest {

    @NotNull
    private UUID masterItemId;

    /** When false, listing is hidden (if it exists). */
    private boolean listed;

    /** LIVE, HIDDEN, or OUT_OF_STOCK — used when listed is true. */
    private String buyerVisibility;

    @DecimalMin("0.01")
    private BigDecimal vendorMrp;

    @DecimalMin("0.01")
    private BigDecimal price;

    @DecimalMin("0.01")
    private BigDecimal discountPrice;

    private String vendorNote;

    private String searchNames;
}
