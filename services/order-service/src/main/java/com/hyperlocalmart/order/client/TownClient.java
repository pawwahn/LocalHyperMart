package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.TownServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class TownClient {

    private final RestClient.Builder restClientBuilder;
    private final TownServiceProperties townServiceProperties;

    public TownSummary getTownSummary(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
        ApiResponse<TownSummary> response = client.get()
                .uri("/api/v1/internal/towns/{townId}/summary", townId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<TownSummary>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Town service returned empty summary");
        }
        return response.getData();
    }

    /** Resolve town delivery fee (DEFAULT/platform or SLAB). Falls back to null on failure. */
    public BigDecimal resolveTownDeliveryFee(UUID townId, BigDecimal orderValue) {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            String uri = orderValue == null
                    ? "/api/v1/internal/towns/{townId}/delivery-fee"
                    : "/api/v1/internal/towns/{townId}/delivery-fee?orderValue={orderValue}";
            ApiResponse<Map<String, Object>> response = (orderValue == null
                    ? client.get().uri(uri, townId)
                    : client.get().uri(uri, townId, orderValue))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return null;
            }
            Object raw = response.getData().get("deliveryFee");
            if (raw instanceof Number n) {
                return BigDecimal.valueOf(n.doubleValue()).setScale(2, java.math.RoundingMode.HALF_UP);
            }
            if (raw instanceof String s && !s.isBlank()) {
                return new BigDecimal(s.trim()).setScale(2, java.math.RoundingMode.HALF_UP);
            }
            return null;
        } catch (Exception ex) {
            return null;
        }
    }

    /** Platform-wide delivery fee (independent of town). Falls back to null on failure. */
    public BigDecimal getPlatformDeliveryFee() {
        try {
            RestClient client = restClientBuilder.baseUrl(townServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/platform/delivery-fee")
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return null;
            }
            Object raw = response.getData().get("deliveryFee");
            if (raw instanceof Number n) {
                return BigDecimal.valueOf(n.doubleValue()).setScale(2, java.math.RoundingMode.HALF_UP);
            }
            if (raw instanceof String s && !s.isBlank()) {
                return new BigDecimal(s.trim()).setScale(2, java.math.RoundingMode.HALF_UP);
            }
            return null;
        } catch (Exception ex) {
            return null;
        }
    }

    public record TownSummary(String townCode, String stateCode, String displayName) {
    }
}
