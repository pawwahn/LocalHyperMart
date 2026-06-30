package com.hyperlocalmart.cart.client;

import com.hyperlocalmart.cart.config.VendorServiceProperties;
import com.hyperlocalmart.common.api.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Component
@RequiredArgsConstructor
public class VendorShopClient {

    private final RestClient.Builder restClientBuilder;
    private final VendorServiceProperties vendorServiceProperties;

    public Map<UUID, String> getShopNames(Collection<UUID> shopIds) {
        if (shopIds == null || shopIds.isEmpty()) {
            return Map.of();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
            ApiResponse<List<ShopInfo>> response = client.post()
                    .uri("/api/v1/internal/shops/batch")
                    .body(Map.of("shopIds", shopIds))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<ShopInfo>>>() {});
            if (response == null || response.getData() == null) {
                return Map.of();
            }
            return response.getData().stream()
                    .collect(Collectors.toMap(ShopInfo::id, ShopInfo::shopName, (a, b) -> a));
        } catch (Exception ex) {
            log.warn("Failed to fetch shop names: {}", ex.getMessage());
            return Map.of();
        }
    }

    public record ShopInfo(UUID id, UUID vendorId, String shopName) {
    }
}
