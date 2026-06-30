package com.hyperlocalmart.payment.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.config.OrderServiceProperties;
import com.hyperlocalmart.payment.entity.PaymentGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class OrderClient {

    private final RestClient.Builder restClientBuilder;
    private final OrderServiceProperties orderServiceProperties;

    public OrderSnapshot getOrder(UUID orderId, UUID buyerId) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<OrderSnapshot> response = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/orders/{orderId}")
                        .queryParam("buyerId", buyerId)
                        .build(orderId))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<OrderSnapshot>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Order not found");
        }
        return response.getData();
    }

    public void markPaymentSuccess(UUID orderId, UUID buyerId, UUID paymentId, PaymentGateway gateway) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        client.post()
                .uri("/api/v1/internal/orders/{orderId}/payment-success", orderId)
                .body(Map.of(
                        "buyerId", buyerId.toString(),
                        "paymentId", paymentId.toString(),
                        "gateway", gateway.name()
                ))
                .retrieve()
                .toBodilessEntity();
    }

    public void markPaymentFailed(UUID orderId, UUID buyerId, UUID paymentId, String reason) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        client.post()
                .uri("/api/v1/internal/orders/{orderId}/payment-failed", orderId)
                .body(Map.of(
                        "buyerId", buyerId.toString(),
                        "paymentId", paymentId.toString(),
                        "reason", reason
                ))
                .retrieve()
                .toBodilessEntity();
    }

    public record OrderSnapshot(
            UUID orderId,
            UUID buyerId,
            UUID townId,
            String status,
            String paymentStatus,
            String paymentMethod,
            BigDecimal totalAmount
    ) {
    }
}
