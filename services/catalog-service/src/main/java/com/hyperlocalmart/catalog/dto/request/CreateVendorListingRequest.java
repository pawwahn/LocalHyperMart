package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Data
public class CreateVendorListingRequest {

    @NotNull
    private UUID masterItemId;

    @DecimalMin("0.01")
    private BigDecimal vendorMrp;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal price;

    @DecimalMin("0.01")
    private BigDecimal discountPrice;

    @DecimalMin("0.01")
    private BigDecimal specialDiscountPrice;

    private Instant specialDiscountValidFrom;

    private Instant specialDiscountValidTo;

    private String vendorNote;

    private Boolean active = false;
}
