package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApplyListingRatingRequest {

    @NotNull
    @Min(1)
    @Max(5)
    private Integer stars;

    /** Present when the buyer is updating an existing rating. */
    @Min(1)
    @Max(5)
    private Integer previousStars;
}
