package com.hyperlocalmart.delivery.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.delivery.config.OrderServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OrderClient {

    private final RestClient.Builder restClientBuilder;
    private final OrderServiceProperties orderServiceProperties;

    public SubOrderSnapshot getSubOrder(UUID subOrderId) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<SubOrderSnapshot> response = client.get()
                .uri("/api/v1/internal/orders/sub-orders/{subOrderId}", subOrderId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<SubOrderSnapshot>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Sub-order not found");
        }
        return response.getData();
    }

    public DeliveryOrderSnapshot getDeliveryOrder(UUID orderId) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<DeliveryOrderSnapshot> response = client.get()
                .uri("/api/v1/internal/orders/{orderId}/delivery-info", orderId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<DeliveryOrderSnapshot>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Order not found");
        }
        return response.getData();
    }

    public PickupManifest getPickupManifest(UUID subOrderId) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<PickupManifest> response = client.get()
                .uri("/api/v1/internal/orders/sub-orders/{subOrderId}/pickup-manifest", subOrderId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<PickupManifest>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Pickup manifest not found");
        }
        return response.getData();
    }

    public void markDelivered(UUID orderId, UUID agentUserId, String recipientName) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new HashMap<>();
        body.put("agentUserId", agentUserId);
        if (recipientName != null) {
            body.put("recipientName", recipientName);
        }
        client.post()
                .uri("/api/v1/internal/orders/{orderId}/delivered", orderId)
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    public record SubOrderSnapshot(
            UUID subOrderId,
            UUID orderId,
            UUID townId,
            UUID vendorId,
            String status,
            String orderNumber,
            String subOrderNumber
    ) {
    }

    public record DeliveryOrderSnapshot(
            UUID orderId,
            UUID buyerId,
            UUID townId,
            String status,
            String orderNumber,
            String buyerPhone
    ) {
    }

    public HubOrderStats getHubOrderStats(UUID townId) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<HubOrderStats> response = client.get()
                .uri("/api/v1/internal/towns/{townId}/hub-order-stats", townId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<HubOrderStats>>() {});
        if (response == null || response.getData() == null) {
            return new HubOrderStats(0, 0);
        }
        return response.getData();
    }

    public HubTownReportStats getHubTownReportStats(UUID townId, LocalDate from, LocalDate to) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<HubTownReportStats> response = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/towns/{townId}/hub-report-stats")
                        .queryParam("from", from.toString())
                        .queryParam("to", to.toString())
                        .build(townId))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<HubTownReportStats>>() {});
        if (response == null || response.getData() == null) {
            return new HubTownReportStats(from, to, 0, 0, 0, 0, 0);
        }
        return response.getData();
    }

    public record HubOrderStats(long readyForPickupCount, long placedOrdersCount) {
    }

    public record HubTownReportStats(
            LocalDate from,
            LocalDate to,
            long ordersPlaced,
            long ordersDelivered,
            long ordersCancelled,
            long subOrdersPlaced,
            long bagsMarkedReady
    ) {
    }

    public record PickupManifestLine(
            String name,
            int quantity,
            String unitCode,
            java.math.BigDecimal lineTotal
    ) {
    }

    public record PickupManifest(
            UUID subOrderId,
            String subOrderNumber,
            String orderNumber,
            UUID shopId,
            String shopName,
            java.math.BigDecimal subtotal,
            int totalItemCount,
            java.util.List<PickupManifestLine> items
    ) {
    }
}
