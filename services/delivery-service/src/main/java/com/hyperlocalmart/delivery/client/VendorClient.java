package com.hyperlocalmart.delivery.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.delivery.config.VendorServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.UUID;

@Component
@RequiredArgsConstructor
public class VendorClient {

    private final RestClient.Builder restClientBuilder;
    private final VendorServiceProperties vendorServiceProperties;

    public ShopSnapshot getShop(UUID shopId) {
        RestClient client = restClientBuilder.baseUrl(vendorServiceProperties.getBaseUrl()).build();
        ApiResponse<ShopSnapshot> response = client.get()
                .uri("/api/v1/internal/shops/{shopId}", shopId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<ShopSnapshot>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Shop not found");
        }
        return response.getData();
    }

    public record ShopSnapshot(
            UUID id,
            UUID vendorId,
            String shopName,
            String address,
            String pincode,
            String phone
    ) {
    }
}
