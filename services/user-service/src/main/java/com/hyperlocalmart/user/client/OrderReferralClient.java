package com.hyperlocalmart.user.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.config.OrderServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OrderReferralClient {

    private final RestClient.Builder restClientBuilder;
    private final OrderServiceProperties orderServiceProperties;

    public boolean buyerHasDeliveredOrder(UUID buyerId) {
        try {
            RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/buyers/{buyerId}/has-delivered-order", buyerId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                return false;
            }
            Object raw = response.getData().get("hasDelivered");
            if (raw instanceof Boolean b) {
                return b;
            }
            return "true".equalsIgnoreCase(String.valueOf(raw));
        } catch (Exception ex) {
            return false;
        }
    }
}
