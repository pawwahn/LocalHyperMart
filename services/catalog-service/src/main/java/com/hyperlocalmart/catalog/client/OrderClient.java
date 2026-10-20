package com.hyperlocalmart.catalog.client;

import com.hyperlocalmart.catalog.config.OrderServiceProperties;
import com.hyperlocalmart.common.api.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderClient {

    private final RestClient.Builder restClientBuilder;
    private final OrderServiceProperties orderServiceProperties;

    public List<UUID> townTopListingIds(UUID townId, int limit) {
        if (townId == null || limit <= 0) {
            return List.of();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, List<UUID>>> response = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/internal/towns/{townId}/top-listings")
                            .queryParam("limit", limit)
                            .build(townId))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, List<UUID>>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            List<UUID> ids = response.getData().get("listingIds");
            return ids == null ? List.of() : ids;
        } catch (Exception ex) {
            log.warn("Could not load town bestsellers from order-service: {}", ex.getMessage());
            return List.of();
        }
    }
}
