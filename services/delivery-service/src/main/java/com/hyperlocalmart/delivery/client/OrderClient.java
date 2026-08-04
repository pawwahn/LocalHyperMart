package com.hyperlocalmart.delivery.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.delivery.config.OrderServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
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
        // Use a Map so older/newer order-service payloads both deserialize safely.
        ApiResponse<Map<String, Object>> response = client.get()
                .uri("/api/v1/internal/orders/{orderId}/delivery-info", orderId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Order not found");
        }
        Map<String, Object> data = response.getData();
        return new DeliveryOrderSnapshot(
                uuidVal(data.get("orderId")),
                uuidVal(data.get("buyerId")),
                uuidVal(data.get("townId")),
                strVal(data.get("status")),
                strVal(data.get("orderNumber")),
                strVal(data.get("buyerPhone")),
                strVal(data.get("recipientName")),
                strVal(data.get("recipientPhone")),
                strVal(data.get("addressLine1")),
                strVal(data.get("addressLine2")),
                strVal(data.get("landmark")),
                strVal(data.get("pincode")),
                strVal(data.get("addressLabel")));
    }

    private static String strVal(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() || "null".equals(text) ? null : text;
    }

    private static UUID uuidVal(Object value) {
        String text = strVal(value);
        return text == null ? null : UUID.fromString(text);
    }

    public PickupManifest getPickupManifest(UUID subOrderId) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<OrderPickupManifestDto> response = client.get()
                .uri("/api/v1/internal/orders/sub-orders/{subOrderId}/pickup-manifest", subOrderId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<OrderPickupManifestDto>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Pickup manifest not found");
        }
        OrderPickupManifestDto dto = response.getData();
        List<PickupManifestLine> lines = dto.getItems() == null
                ? List.of()
                : dto.getItems().stream()
                .map(line -> new PickupManifestLine(
                        line.getName(),
                        line.getQuantity(),
                        line.resolvedUnitCode(),
                        line.getLineTotal()))
                .toList();
        return new PickupManifest(
                dto.getSubOrderId(),
                dto.getSubOrderNumber(),
                dto.getOrderNumber(),
                dto.getShopId(),
                dto.getShopName(),
                dto.getSubtotal(),
                dto.getTotalItemCount(),
                lines);
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
            String buyerPhone,
            String recipientName,
            String recipientPhone,
            String addressLine1,
            String addressLine2,
            String landmark,
            String pincode,
            String addressLabel
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
