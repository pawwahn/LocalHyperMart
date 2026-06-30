package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.UserServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AddressClient {

    private final RestClient.Builder restClientBuilder;
    private final UserServiceProperties userServiceProperties;

    public Map<String, Object> getAddressSnapshot(UUID addressId, UUID userId, UUID townId) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        ApiResponse<Map<String, Object>> response = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/addresses/{addressId}")
                        .queryParam("userId", userId)
                        .queryParam("townId", townId)
                        .build(addressId))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("User service returned empty address response");
        }
        return response.getData();
    }
}
