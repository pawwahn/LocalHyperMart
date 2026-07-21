package com.hyperlocalmart.delivery.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.config.UserServiceProperties;
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
public class UserClient {

    private final RestClient.Builder restClientBuilder;
    private final UserServiceProperties userServiceProperties;

    public UUID createDeliveryAgentUser(String phone, String password, String firstName) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<StaffUserDto> response = client.post()
                    .uri("/api/v1/internal/users/staff")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "phone", phone,
                            "password", password,
                            "firstName", firstName,
                            "role", "DELIVERY_AGENT"
                    ))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<StaffUserDto>>() {});
            if (response == null || response.getData() == null || response.getData().userId() == null) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Failed to create agent login");
            }
            return response.getData().userId();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Could not create agent login");
        }
    }

    public void updateUserStatus(UUID userId, String status) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            client.patch()
                    .uri("/api/v1/internal/users/{userId}/status", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("status", status))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Could not update agent login status");
        }
    }

    private BusinessException mapClientError(RestClientResponseException ex, String fallback) {
        String body = ex.getResponseBodyAsString();
        if (body != null && body.contains("already registered")) {
            return new BusinessException(ErrorCode.CONFLICT, "Phone number already registered");
        }
        if (ex.getStatusCode().value() == 409) {
            return new BusinessException(ErrorCode.CONFLICT, fallback);
        }
        if (ex.getStatusCode().value() == 400) {
            return new BusinessException(ErrorCode.VALIDATION_ERROR, fallback);
        }
        return new BusinessException(ErrorCode.INTERNAL_ERROR, fallback);
    }

    public record StaffUserDto(UUID userId, String phone, String role, String status) {
    }
}
