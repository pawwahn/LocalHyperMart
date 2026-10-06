package com.hyperlocalmart.cart.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class CatalogListingClient {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private final RestClient.Builder restClientBuilder;
    private final CatalogServiceProperties catalogServiceProperties;

    public Map<UUID, String> primaryImages(List<UUID> listingIds) {
        if (listingIds == null || listingIds.isEmpty()) {
            return Map.of();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(catalogServiceProperties.getBaseUrl()).build();
            ApiResponse<List<PrimaryImageRow>> response = client.post()
                    .uri("/api/v1/internal/catalog/listing-primary-images")
                    .body(Map.of("listingIds", listingIds))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<PrimaryImageRow>>>() {});
            if (response == null || response.getData() == null) {
                return Map.of();
            }
            return response.getData().stream()
                    .filter(row -> row.listingId() != null && row.imageUrl() != null && !row.imageUrl().isBlank())
                    .collect(Collectors.toMap(PrimaryImageRow::listingId, PrimaryImageRow::imageUrl, (a, b) -> a));
        } catch (RestClientResponseException ex) {
            return Collections.emptyMap();
        }
    }

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
            String message = readApiMessage(ex.getResponseBodyAsString());
            if (message == null || message.isBlank()) {
                message = "Listing is not available";
            }
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
    }

    private static String readApiMessage(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        try {
            JsonNode root = OBJECT_MAPPER.readTree(body);
            JsonNode message = root.get("message");
            return message != null && message.isTextual() ? message.asText() : null;
        } catch (Exception ignored) {
            return null;
        }
    }

    private record PrimaryImageRow(UUID listingId, String imageUrl) {
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
            boolean active,
            String hsnCode,
            BigDecimal gstPercent,
            BigDecimal cessPercent,
            boolean priceIncludesTax,
            String countryOfOrigin
    ) {
    }
}
