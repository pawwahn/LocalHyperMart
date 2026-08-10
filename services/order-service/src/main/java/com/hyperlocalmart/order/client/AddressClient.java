package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.config.UserServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class AddressClient {

    private final RestClient.Builder restClientBuilder;
    private final UserServiceProperties userServiceProperties;

    public Map<String, Object> getAddressSnapshot(UUID addressId, UUID userId, UUID townId) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/internal/addresses/{addressId}")
                            .queryParam("userId", userId)
                            .queryParam("townId", townId)
                            .build(addressId))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR, "User service returned empty address response");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex);
        }
    }

    private BusinessException mapClientError(RestClientResponseException ex) {
        String message = extractMessage(ex.getResponseBodyAsString());
        if (message == null || message.isBlank()) {
            message = "Could not validate delivery address";
        }
        int status = ex.getStatusCode().value();
        if (status == 400) {
            return new BusinessException(ErrorCode.VALIDATION_ERROR, message);
        }
        if (status == 404) {
            return new BusinessException(ErrorCode.NOT_FOUND, message);
        }
        if (status == 409) {
            return new BusinessException(ErrorCode.CONFLICT, message);
        }
        return new BusinessException(ErrorCode.INTERNAL_ERROR, message);
    }

    private static String extractMessage(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }
        // Lightweight parse: {"success":false,"message":"..."}
        int key = body.indexOf("\"message\"");
        if (key < 0) {
            return null;
        }
        int colon = body.indexOf(':', key);
        int firstQuote = body.indexOf('"', colon + 1);
        int secondQuote = firstQuote >= 0 ? body.indexOf('"', firstQuote + 1) : -1;
        if (firstQuote < 0 || secondQuote < 0) {
            return null;
        }
        return body.substring(firstQuote + 1, secondQuote);
    }
}
