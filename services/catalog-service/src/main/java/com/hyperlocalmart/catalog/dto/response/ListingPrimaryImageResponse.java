package com.hyperlocalmart.catalog.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ListingPrimaryImageResponse {

    private UUID listingId;
    private String imageUrl;
}
