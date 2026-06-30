package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.CatalogServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CatalogClient {

    private final RestClient.Builder restClientBuilder;
    private final CatalogServiceProperties catalogServiceProperties;

    public ListingSnapshot getListing(UUID listingId, UUID townId) {
        RestClient client = restClientBuilder.baseUrl(catalogServiceProperties.getBaseUrl()).build();
        ApiResponse<ListingSnapshot> response = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/listings/{listingId}")
                        .queryParam("townId", townId)
                        .build(listingId))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<ListingSnapshot>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Listing not found");
        }
        return response.getData();
    }

    public record ListingSnapshot(
            UUID listingId,
            UUID townId,
            UUID vendorId,
            UUID shopId,
            UUID masterItemId,
            String name,
            String unit,
            BigDecimal price,
            BigDecimal discountPrice,
            boolean active
    ) {
    }
}
