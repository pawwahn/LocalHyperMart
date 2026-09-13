package com.hyperlocalmart.payment.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.UserServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class UserClient {

    private final RestClient.Builder restClientBuilder;
    private final UserServiceProperties userServiceProperties;

    public UserProfile findByPhone(String phone) {
        RestClient client = restClientBuilder.baseUrl(userServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<UserProfile> response = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/internal/users/by-phone")
                            .queryParam("phone", phone)
                            .build())
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<UserProfile>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Customer not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Customer not found");
            }
            throw new IllegalStateException("User lookup failed: " + ex.getMessage(), ex);
        }
    }

    public record UserProfile(UUID id, String phone, List<String> roles, String status) {
        public boolean isBuyer() {
            return roles != null && roles.stream().anyMatch(r -> "BUYER".equalsIgnoreCase(r));
        }
    }
}
