package com.hyperlocalmart.cart.client;

import com.hyperlocalmart.cart.config.OrderServiceProperties;
import com.hyperlocalmart.common.api.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class OrderHistoryClient {

    private final RestClient.Builder restClientBuilder;
    private final OrderServiceProperties orderServiceProperties;

    public List<UUID> recentListingIds(UUID buyerId, UUID townId, int limit) {
        if (buyerId == null || townId == null) {
            return List.of();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
            ApiResponse<List<UUID>> response = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/internal/buyers/{buyerId}/recent-listing-ids")
                            .queryParam("townId", townId)
                            .queryParam("limit", limit)
                            .build(buyerId))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<UUID>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData().stream().filter(id -> id != null).distinct().toList();
        } catch (Exception ex) {
            log.warn("Failed to load previous-order listings: {}", ex.getMessage());
            return List.of();
        }
    }
}
