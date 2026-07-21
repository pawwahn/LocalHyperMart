package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

import java.math.BigDecimal;
import java.time.Instant;

@Data
public class UpdateVendorListingRequest {

    @DecimalMin("0.01")
    private BigDecimal vendorMrp;

    @DecimalMin("0.01")
    private BigDecimal price;

    @DecimalMin("0.01")
    private BigDecimal discountPrice;

    @DecimalMin("0.01")
    private BigDecimal specialDiscountPrice;

    private Instant specialDiscountValidFrom;

    private Instant specialDiscountValidTo;

    private String vendorNote;

    private Boolean active;

    /** When true, nullable pricing fields are cleared instead of ignored. */
    private Boolean replacePricing;
}
