package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ProductRatingResponse {

    private UUID ratingId;
    private UUID orderId;
    private UUID orderItemId;
    private UUID listingId;
    private int stars;
}
