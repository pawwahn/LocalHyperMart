package com.hyperlocalmart.cart.client;

import com.hyperlocalmart.cart.config.TownServiceProperties;
import com.hyperlocalmart.common.api.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TownConfigClient {

    private static final BigDecimal DEFAULT_MIN_ORDER = new BigDecimal("199");

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    public BigDecimal getMinOrderValue(UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<OperationalConfig> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/operational-config", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<OperationalConfig>>() {});
            if (response == null || response.getData() == null || response.getData().minOrderValue() == null) {
                return DEFAULT_MIN_ORDER;
            }
            return response.getData().minOrderValue();
        } catch (Exception ex) {
            return DEFAULT_MIN_ORDER;
        }
    }

    public record OperationalConfig(BigDecimal minOrderValue) {
    }
}
