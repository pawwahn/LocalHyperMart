package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.DeliveryServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryClient {

    private final RestClient.Builder restClientBuilder;
    private final DeliveryServiceProperties deliveryServiceProperties;
    private final ConcurrentHashMap<UUID, HubEnabledCache> hubEnabledCache = new ConcurrentHashMap<>();

    /**
     * Active hub for the town. On failure, treat the hub as enabled so a split order
     * does not gain shop-agent delivery during an outage.
     */
    public boolean isTownHubEnabled(UUID townId) {
        if (townId == null) {
            return true;
        }
        HubEnabledCache cached = hubEnabledCache.get(townId);
        if (cached != null && cached.expiresAt().isAfter(Instant.now())) {
            return cached.enabled();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
            ApiResponse<Map<String, Object>> response = client.get()
                    .uri("/api/v1/internal/towns/{townId}/hub-enabled", townId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
            boolean enabled = response != null
                    && response.getData() != null
                    && Boolean.TRUE.equals(response.getData().get("enabled"));
            hubEnabledCache.put(townId, new HubEnabledCache(enabled, Instant.now().plusSeconds(20)));
            return enabled;
        } catch (Exception ex) {
            log.warn("Hub status lookup failed for town {}: {}", townId, ex.getMessage());
            return true;
        }
    }

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

    public List<UUID> listAgentCompletedDeliveryOrderIds(UUID agentId, Instant from, Instant to) {
        if (agentId == null || from == null || to == null) {
            return List.of();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
            ApiResponse<List<UUID>> response = client.get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/internal/agents/{agentId}/completed-delivery-order-ids")
                            .queryParam("from", from.toString())
                            .queryParam("to", to.toString())
                            .build(agentId))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<UUID>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData();
        } catch (Exception ex) {
            log.warn("Failed to list agent completed delivery orders: {}", ex.getMessage());
            return List.of();
        }
    }

    public List<OrderLegs> resolveDeliveryLegs(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return List.of();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
            ApiResponse<List<OrderLegs>> response = client.post()
                    .uri("/api/v1/internal/orders/delivery-legs/resolve")
                    .body(List.copyOf(orderIds))
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<OrderLegs>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData();
        } catch (Exception ex) {
            log.warn("Failed to batch-resolve delivery legs: {}", ex.getMessage());
            return List.of();
        }
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

    public List<VendorAgent> listVendorAgents(UUID vendorId) {
        if (vendorId == null) {
            return List.of();
        }
        try {
            RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
            ApiResponse<List<Map<String, Object>>> response = client.get()
                    .uri("/api/v1/internal/vendors/{vendorId}/agents", vendorId)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<List<Map<String, Object>>>>() {});
            if (response == null || response.getData() == null) {
                return List.of();
            }
            return response.getData().stream()
                    .map(DeliveryClient::vendorAgentFromMap)
                    .toList();
        } catch (Exception ex) {
            log.warn("Failed to list vendor agents for {}: {}", vendorId, ex.getMessage());
            return List.of();
        }
    }

    private static VendorAgent vendorAgentFromMap(Map<String, Object> row) {
        UUID agentId = uuid(row.get("agentId"));
        String name = text(row.get("name"));
        String phone = text(row.get("phone"));
        String status = text(row.get("status"));
        return new VendorAgent(agentId, name, phone, status);
    }

    private static UUID uuid(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof UUID id) {
            return id;
        }
        try {
            return UUID.fromString(String.valueOf(raw));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String text(Object raw) {
        if (raw == null) {
            return null;
        }
        String value = String.valueOf(raw).trim();
        return value.isEmpty() ? null : value;
    }

    public void assignLaundryTrip(
            UUID laundryOrderId,
            String orderNumber,
            UUID townId,
            UUID vendorId,
            UUID agentId,
            UUID assignedBy,
            String shopName,
            String contactName,
            String contactPhone,
            String addressText,
            String tripKind,
            String paymentMethod,
            java.math.BigDecimal collectCashAmount) {
        RestClient client = restClientBuilder.baseUrl(deliveryServiceProperties.getBaseUrl()).build();
        java.util.Map<String, Object> body = new java.util.HashMap<>();
        body.put("laundryOrderId", laundryOrderId);
        body.put("orderNumber", orderNumber);
        body.put("townId", townId);
        body.put("vendorId", vendorId);
        body.put("agentId", agentId);
        body.put("assignedBy", assignedBy);
        body.put("shopName", shopName);
        body.put("contactName", contactName);
        body.put("contactPhone", contactPhone);
        body.put("addressText", addressText);
        body.put("tripKind", tripKind);
        body.put("paymentMethod", paymentMethod);
        body.put("collectCashAmount", collectCashAmount);
        client.post()
                .uri("/api/v1/internal/laundry-trips/assign")
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    public record VendorAgent(UUID agentId, String name, String phone, String status) {
    }

    public record HubAdminContext(UUID userId, UUID hubId, UUID townId) {
    }

    public record HubContact(UUID userId, UUID hubId, String hubName, String phone) {
    }

    public record OrderLegs(
            UUID orderId,
            UUID hubId,
            UUID agentId,
            boolean lastMileCompleted,
            Instant lastMileCompletedAt,
            boolean pickupCompleted,
            Instant pickupCompletedAt,
            boolean vendorDirectCompleted,
            Instant vendorDirectCompletedAt,
            boolean laundryDropCompleted,
            Instant laundryDropCompletedAt
    ) {
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

    private record HubEnabledCache(boolean enabled, Instant expiresAt) {
    }

    public record AgentAlertSummary(
            UUID vendorSubOrderId,
            UUID alertId,
            String status,
            Instant acknowledgedAt
    ) {
    }
}
