package com.hyperlocalmart.notification.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.notification.config.UserServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserServiceClient {

    private final RestClient.Builder restClientBuilder;
    private final UserServiceProperties userServiceProperties;

    public List<DeviceTokenView> listDeviceTokens(UUID userId, String appType) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<List<DeviceTokenView>> response = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/internal/users/{userId}/device-tokens")
                            .queryParam("appType", appType)
                            .build(userId))
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (response == null || response.getData() == null) {
                return Collections.emptyList();
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            log.warn("Could not load device tokens for user {}: {}", userId, ex.getMessage());
            return Collections.emptyList();
        } catch (Exception ex) {
            log.warn("User service device token lookup failed for {}: {}", userId, ex.getMessage());
            return Collections.emptyList();
        }
    }
}
