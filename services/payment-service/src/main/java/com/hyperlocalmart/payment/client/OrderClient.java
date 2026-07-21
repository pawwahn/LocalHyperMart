package com.hyperlocalmart.payment.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.config.OrderServiceProperties;
import com.hyperlocalmart.payment.entity.PaymentGateway;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
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

    public SettlementCandidates getSettlementCandidates(
            UUID vendorId, UUID townId, LocalDate from, LocalDate to) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<SettlementCandidates> response = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/orders/settlement-candidates")
                        .queryParam("vendorId", vendorId)
                        .queryParam("townId", townId)
                        .queryParam("from", from)
                        .queryParam("to", to)
                        .build())
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<SettlementCandidates>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Settlement candidates unavailable");
        }
        return response.getData();
    }

    public List<SettlementCandidateItem> resolveSettlementSubOrders(UUID vendorId, Collection<UUID> subOrderIds) {
        RestClient client = restClientBuilder.baseUrl(orderServiceProperties.getBaseUrl()).build();
        ApiResponse<List<SettlementCandidateItem>> response = client.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/orders/settlement-candidates/resolve")
                        .queryParam("vendorId", vendorId)
                        .build())
                .body(List.copyOf(subOrderIds))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<List<SettlementCandidateItem>>>() {});
        if (response == null || response.getData() == null) {
            return List.of();
        }
        return response.getData();
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

    public record SettlementCandidates(
            UUID vendorId,
            UUID townId,
            String from,
            String to,
            List<SettlementCandidateItem> items
    ) {
    }

    public record SettlementCandidateItem(
            UUID subOrderId,
            UUID orderId,
            String orderNumber,
            String subOrderNumber,
            Instant placedAt,
            String status,
            String paymentStatus,
            BigDecimal subtotal
    ) {
    }
}
