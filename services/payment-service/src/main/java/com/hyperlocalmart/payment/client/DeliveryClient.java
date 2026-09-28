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

import java.time.Instant;
import java.util.Collection;
import java.util.List;
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

    public AgentContext getAgentByUserId(UUID userId) {
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<AgentContext> response = client.get()
                    .uri("/api/v1/internal/agents/by-user/{userId}", userId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<AgentContext>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found");
            }
            return response.getData();
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 404) {
                throw new BusinessException(ErrorCode.NOT_FOUND, "Delivery agent not found");
            }
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load delivery agent");
        }
    }

    public List<OrderLegs> resolveDeliveryLegs(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        try {
            ApiResponse<List<OrderLegs>> response = client.post()
                    .uri("/api/v1/internal/orders/delivery-legs/resolve")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(List.copyOf(orderIds))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<OrderLegs>>>() {});
            if (response == null || response.getData() == null) {
                throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load delivery trips for payout");
            }
            return response.getData();
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Could not load delivery trips for payout");
        }
    }

    public record AgentContext(UUID agentId, UUID userId, String name, String phone, UUID hubId, UUID townId) {
    }

    public record OrderLegs(
            UUID orderId,
            UUID hubId,
            UUID agentId,
            boolean lastMileCompleted,
            Instant lastMileCompletedAt,
            boolean pickupCompleted,
            Instant pickupCompletedAt
    ) {
    }

    public record HubAdminContext(UUID userId, UUID hubId, UUID townId) {
    }

    public record VerifyHubPinResult(boolean valid) {
    }
}
