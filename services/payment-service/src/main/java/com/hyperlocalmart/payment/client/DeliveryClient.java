package com.hyperlocalmart.payment.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.DeliveryServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class DeliveryClient {

    private final RestClient.Builder restClientBuilder;
    private final DeliveryServiceProperties deliveryServiceProperties;

    public HubAdminContext getHubAdminContext(UUID userId) {
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<HubAdminContext> response = client.get()
                    .uri("/api/v1/internal/hub-admins/{userId}/context", userId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<HubAdminContext>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Hub admin context not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Hub admin context not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load hub admin context");
        }
    }

    public void verifyHubPin(UUID userId, String pin) {
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<VerifyHubPinResult> response = client.post()
                    .uri("/api/v1/internal/hub-admins/{userId}/verify-pin", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("pin", pin))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<VerifyHubPinResult>>() {});
            if (response == null || response.getData() == null || !response.getData().valid()) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Invalid hub PIN");
            }
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 403) {
                throw new BusinessException(ErrorCode.FORBIDDEN, "Invalid hub PIN");
            }
            if (ex.getStatusCode().value() == 400) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid hub PIN");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not verify hub PIN");
        }
    }

    public record HubAdminContext(UUID userId, UUID hubId, UUID townId) {
    }

    public record VerifyHubPinResult(boolean valid) {
    }
}
