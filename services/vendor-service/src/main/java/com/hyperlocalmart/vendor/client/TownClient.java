package com.hyperlocalmart.vendor.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.vendor.config.TownServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class TownClient {

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    /** False when the town is missing, disabled, or town-service cannot be reached. */
    public boolean acceptingOrders(UUID townId) {
        if (townId == null) {
            return false;
        }
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/exists", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return false;
            }
            Object accepting = response.getData().get("acceptingOrders");
            if (accepting instanceof Boolean enabled) {
                return enabled;
            }
            Object exists = response.getData().get("exists");
            return exists instanceof Boolean enabled && enabled;
        } catch (Exception ex) {
            log.warn("Could not read town {} status: {}", townId, ex.getMessage());
            return false;
        }
    }
}