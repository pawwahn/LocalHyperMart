package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
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

    /** Comma-separated alternate names for search. Blank clears them. */
    private String searchNames;

    @Size(max = 1000)
    private String description;

    @DecimalMin("0.01")
    private BigDecimal mrp;

    /** Harmonized System of Nomenclature (4–8 digits) — required for GST invoices. */
    @NotBlank
    @Pattern(regexp = "^[0-9]{4,8}$")
    private String hsnCode;

    /** GST slab: 0, 0.25, 3, 5, 12, 18, or 28. */
    @NotNull
    private BigDecimal gstPercent;

    @DecimalMin("0")
    private BigDecimal cessPercent;

    /** When true, MRP/list price includes GST (typical retail). */
    private Boolean priceIncludesTax;

    /** ISO 3166-1 alpha-2, e.g. IN. */
    @Size(min = 2, max = 2)
    private String countryOfOrigin;
}
