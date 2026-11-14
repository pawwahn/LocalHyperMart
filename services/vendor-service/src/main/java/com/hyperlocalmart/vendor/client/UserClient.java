package com.hyperlocalmart.vendor.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.config.UserServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class UserClient {

    private final RestClient.Builder restClientBuilder;
    private final UserServiceProperties userServiceProperties;

    public UserProfileDto findUserByPhone(String phone) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<UserProfileDto> response = client.get()
                    .uri(uriBuilder -> uriBuilder.path("/api/v1/internal/users/by-phone").queryParam("phone", phone).build())
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<UserProfileDto>>() {});
            if (response == null || response.getData() == null || response.getData().id() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "User not found for phone");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Could not look up phone");
        }
    }

    public UUID findUserIdByPhone(String phone) {
        return findUserByPhone(phone).id();
    }

    public UUID createVendorUser(String phone, String password, String firstName, UUID townId) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new HashMap<>();
        body.put("phone", phone);
        body.put("password", password);
        body.put("firstName", firstName);
        body.put("role", "VENDOR");
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
                throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Failed to create vendor login");
            }
            return response.getData().userId();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Could not create vendor login");
        }
    }

    public void bindVendorContext(UUID userId, UUID townId, UUID vendorId) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            client.patch()
                    .uri("/api/v1/internal/users/{userId}/context", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of(
                            "townId", townId.toString(),
                            "vendorId", vendorId.toString()
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Could not bind vendor context");
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
            throw mapClientError(ex, "Could not update vendor login status");
        }
    }

    public void setUserPassword(UUID userId, String newPassword) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            client.patch()
                    .uri("/api/v1/internal/users/{userId}/password", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("newPassword", newPassword))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Could not set user password");
        } catch (ResourceAccessException ex) {
            throw new BusinessException(
                    ErrorCode.VALIDATION_ERROR,
                    "User service is not reachable at "
                            + userServiceProperties.getBaseUrl()
                            + " — start user-service and try again");
        } catch (RestClientException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Could not reach user service to set password");
        }
    }

    private BusinessException mapClientError(RestClientResponseException ex, String fallback) {
        String body = ex.getResponseBodyAsString();
        String detail = extractMessage(body, fallback);
        if (body != null && body.contains("already registered")) {
            return new BusinessException(ErrorCode.CONFLICT, "Phone number already registered");
        }
        int status = ex.getStatusCode().value();
        if (status == 404) {
            return new BusinessException(ErrorCode.NOT_FOUND, detail);
        }
        if (status == 409) {
            return new BusinessException(ErrorCode.CONFLICT, detail);
        }
        if (status == 400) {
            return new BusinessException(ErrorCode.VALIDATION_ERROR, detail);
        }
        if (status >= 500) {
            return new BusinessException(ErrorCode.INTERNAL_ERROR, detail);
        }
        return new BusinessException(ErrorCode.INTERNAL_ERROR, detail);
    }

    private static String extractMessage(String body, String fallback) {
        if (body == null || body.isBlank()) {
            return fallback;
        }
        int idx = body.indexOf("\"message\"");
        if (idx < 0) {
            return fallback;
        }
        int start = body.indexOf(':', idx);
        if (start < 0) {
            return fallback;
        }
        int q1 = body.indexOf('"', start + 1);
        int q2 = q1 < 0 ? -1 : body.indexOf('"', q1 + 1);
        if (q1 < 0 || q2 < 0) {
            return fallback;
        }
        String msg = body.substring(q1 + 1, q2).trim();
        return msg.isBlank() ? fallback : msg;
    }

    public void consumeCodPinOtp(UUID userId, String otp) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            client.post()
                    .uri("/api/v1/internal/users/{userId}/cod-pin-otp/consume", userId)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Map.of("otp", otp))
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw mapClientError(ex, "Invalid or expired OTP");
        }
    }

    public record StaffUserDto(UUID userId, String phone, String role, String status) {
    }

    public record UserProfileDto(UUID id, String phone, java.util.List<String> roles, String status) {
    }
}
