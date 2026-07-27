package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.CatalogServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CatalogClient {

    private final RestClient.Builder restClientBuilder;
    private final CatalogServiceProperties catalogServiceProperties;

    public ListingSnapshot getListing(UUID listingId, UUID townId) {
        return getListing(listingId, townId, true);
    }

    /** For order/delivery reads — returns unit even if listing is no longer active. */
    public ListingSnapshot getListingForOrderRead(UUID listingId, UUID townId) {
        return getListing(listingId, townId, false);
    }

    private ListingSnapshot getListing(UUID listingId, UUID townId, boolean requireActive) {
        RestClient client = restClientBuilder.baseUrl(catalogServiceProperties.getBaseUrl()).build();
        ApiResponse<ListingSnapshot> response = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/listings/{listingId}")
                        .queryParam("townId", townId)
                        .queryParam("requireActive", requireActive)
                        .build(listingId))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<ListingSnapshot>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Listing not found");
        }
        return response.getData();
    }

    public void applyListingRating(UUID listingId, int stars, Integer previousStars) {
        RestClient client = restClientBuilder.baseUrl(catalogServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new HashMap<>();
        body.put("stars", stars);
        if (previousStars != null) {
            body.put("previousStars", previousStars);
        }
        client.post()
                .uri("/api/v1/internal/listings/{listingId}/ratings", listingId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .toBodilessEntity();
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
            BigDecimal effectivePrice,
            boolean active
    ) {
    }
}
