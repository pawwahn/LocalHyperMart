package com.hyperlocalmart.vendor.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.vendor.config.DeliveryServiceProperties;
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
public class DeliveryClient {

    private final RestClient.Builder restClientBuilder;
    private final DeliveryServiceProperties deliveryServiceProperties;

    public List<HubContact> listHubContactsForTown(UUID townId) {
        try {
            RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
            ApiResponse<List<HubContact>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/hub-contacts", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<HubContact>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData();
        } catch (Exception ex) {
            log.warn("Failed to fetch hub contacts for town {}: {}", townId, ex.getMessage());
            return List.of();
        }
    }

    public record HubContact(UUID userId, UUID hubId, String hubName, String phone) {
    }
}
