package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

@Data
@Builder
public class ListingRatingSummaryResponse {

    private UUID listingId;
    private BigDecimal avgRating;
    private int ratingCount;
}
