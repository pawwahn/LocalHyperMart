package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Data
public class UpsertFoodMenuItemRequest {

    @NotNull
    private UUID categoryId;

    @NotBlank
    @Size(max = 200)
    private String name;

    @Size(max = 500)
    private String description;

    /** Mandatory — shown on buyer menu (ingredients, portion, spice). */
    @NotBlank
    @Size(max = 500)
    private String buyerNote;

    @NotNull
    @DecimalMin("0.01")
    private BigDecimal price;

    /** Required: true = veg, false = non-veg. */
    @NotNull
    private Boolean veg;

    private Integer sortOrder;

    private Boolean active;

    /**
     * Optional dish photos (up to 3). {@code null} = leave existing images unchanged;
     * empty list clears all listing images.
     */
    @Valid
    @Size(max = 3)
    private List<SetVendorListingImagesRequest.ImageRef> images;
}