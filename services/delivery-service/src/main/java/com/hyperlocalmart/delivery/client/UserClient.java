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

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class UserClient {

    private final RestClient.Builder restClientBuilder;
    private final UserServiceProperties userServiceProperties;

    public UUID createDeliveryAgentUser(String phone, String password, String firstName) {
        return createStaffUser(phone, password, firstName, null, null, "DELIVERY_AGENT");
    }

    public UUID createHubAdminUser(String phone, String password, String firstName, String lastName, UUID townId) {
        return createStaffUser(phone, password, firstName, lastName, townId, "HUB_ADMIN");
    }

    public void bindHubContext(UUID userId, UUID townId, UUID hubId) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            client.patch()
                    .uri("/api/v1/internal/users/{userId}/context", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "townId", townId.toString(),
                            "hubId", hubId.toString()
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Could not bind hub admin context");
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

    private UUID createStaffUser(
            String phone,
            String password,
            String firstName,
            String lastName,
            UUID townId,
            String role
    ) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new HashMap<>();
        body.put("phone", phone);
        body.put("password", password);
        body.put("firstName", firstName);
        body.put("role", role);
        if (lastName != null && !lastName.isBlank()) {
            body.put("lastName", lastName.trim());
        }
        if (townId != null) {
            body.put("townId", townId.toString());
        }
        try {
            ApiResponse<StaffUserDto> response = client.post()
                    .uri("/api/v1/internal/users/staff")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<StaffUserDto>>() {});
            if (response == null || response.getData() == null || response.getData().userId() == null) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Failed to create staff login");
            }
            return response.getData().userId();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Could not create staff login");
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
