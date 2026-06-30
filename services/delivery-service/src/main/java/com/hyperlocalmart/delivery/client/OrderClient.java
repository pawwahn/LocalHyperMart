package com.hyperlocalmart.delivery.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.delivery.config.OrderServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

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
            String orderNumber
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
}
