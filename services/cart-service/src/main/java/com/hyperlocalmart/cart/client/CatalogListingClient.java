package com.hyperlocalmart.cart.client;

import com.hyperlocalmart.cart.config.CatalogServiceProperties;
import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CatalogListingClient {

    private final RestClient.Builder restClientBuilder;
    private final CatalogServiceProperties catalogServiceProperties;

    public ListingSnapshot getListing(UUID listingId, UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(catalogServiceProperties.getBaseUrl()).build();
            ApiResponse<ListingSnapshot> response = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/internal/listings/{listingId}")
                            .queryParam("townId", townId)
                            .build(listingId))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<ListingSnapshot>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Listing not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Listing is not available");
        }
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
