package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
public class CreateVendorListingRequest {

    @NotNull
    private UUID masterItemId;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal price;

    @DecimalMin("0.01")
    private BigDecimal discountPrice;

    private String vendorNote;

    private Boolean active = true;
}
