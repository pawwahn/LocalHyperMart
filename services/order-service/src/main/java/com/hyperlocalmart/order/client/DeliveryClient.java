package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.DeliveryServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryClient {

    private final RestClient.Builder restClientBuilder;
    private final DeliveryServiceProperties deliveryServiceProperties;

    public HubAdminContext getHubAdminContext(UUID userId) {
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        ApiResponse<HubAdminContext> response = client.get()
                .uri("/api/v1/internal/hub-admins/{userId}/context", userId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<HubAdminContext>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Hub admin context not found");
        }
        return response.getData();
    }

    public List<OrderAssignment> getAssignmentsForOrder(UUID orderId) {
        try {
            RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
            ApiResponse<List<OrderAssignment>> response = client.get()
                    .uri("/api/v1/internal/orders/{orderId}/assignments", orderId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<OrderAssignment>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData();
        } catch (Exception ex) {
            log.warn("Failed to fetch assignments for order {}: {}", orderId, ex.getMessage());
            return List.of();
        }
    }

    public record HubAdminContext(UUID userId, UUID hubId, UUID townId) {
    }

    public record OrderAssignment(
            UUID assignmentId,
            String assignmentNumber,
            String orderNumber,
            String subOrderNumber,
            UUID agentId,
            String legType,
            String status,
            Instant assignedAt,
            Instant startedAt,
            Instant completedAt,
            List<OrderAssignmentEvent> events
    ) {
    }

    public record OrderAssignmentEvent(
            UUID eventId,
            String eventType,
            Instant createdAt,
            UUID createdBy,
            Map<String, Object> metadata
    ) {
    }
}
