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

    public void assignVendorDirectDelivery(UUID vendorId, UUID vendorSubOrderId, UUID agentId, UUID actorUserId) {
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        Map<String, UUID> body = Map.of(
                "vendorId", vendorId,
                "agentId", agentId,
                "assignedBy", actorUserId);
        client.post()
                .uri("/api/v1/internal/vendor-sub-orders/{subOrderId}/assign-vendor-direct", vendorSubOrderId)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    public AgentAlertCreated notifyVendorAgent(UUID vendorId, UUID vendorSubOrderId, UUID actorUserId) {
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        Map<String, UUID> body = Map.of(
                "vendorId", vendorId,
                "actorUserId", actorUserId);
        ApiResponse<AgentAlertCreated> response = client.post()
                .uri("/api/v1/internal/vendor-sub-orders/{subOrderId}/agent-alerts", vendorSubOrderId)
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<AgentAlertCreated>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Agent alert failed");
        }
        return response.getData();
    }

    public AgentAlertCreated notifyHubAgent(UUID townId, UUID vendorSubOrderId, UUID actorUserId) {
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        Map<String, UUID> body = Map.of(
                "townId", townId,
                "actorUserId", actorUserId);
        ApiResponse<AgentAlertCreated> response = client.post()
                .uri("/api/v1/internal/vendor-sub-orders/{subOrderId}/hub-agent-alerts", vendorSubOrderId)
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<AgentAlertCreated>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Agent alert failed");
        }
        return response.getData();
    }

    public List<AgentAlertSummary> summarizeAgentAlerts(List<UUID> vendorSubOrderIds) {
        if (vendorSubOrderIds == null || vendorSubOrderIds.isEmpty()) {
            return List.of();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
            ApiResponse<List<AgentAlertSummary>> response = client.post()
                    .uri("/api/v1/internal/vendor-sub-orders/agent-alert-summaries")
                    .body(vendorSubOrderIds)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<AgentAlertSummary>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData();
        } catch (Exception ex) {
            log.warn("Failed to fetch agent alert summaries: {}", ex.getMessage());
            return List.of();
        }
    }

    public record HubAdminContext(UUID userId, UUID hubId, UUID townId) {
    }

    public record HubContact(UUID userId, UUID hubId, String hubName, String phone) {
    }

    public record OrderAssignment(
            UUID assignmentId,
            String assignmentNumber,
            String orderNumber,
            String subOrderNumber,
            UUID agentId,
            String agentName,
            String agentPhone,
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

    public record AgentAlertCreated(UUID alertId, String status) {
    }

    public record AgentAlertSummary(
            UUID vendorSubOrderId,
            UUID alertId,
            String status,
            Instant acknowledgedAt
    ) {
    }
}
