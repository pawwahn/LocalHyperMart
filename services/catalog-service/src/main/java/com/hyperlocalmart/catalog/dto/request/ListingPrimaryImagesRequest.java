package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class ListingPrimaryImagesRequest {

    @NotEmpty
    private List<UUID> listingIds;
}
