package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.CartServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class CartClient {

    private final RestClient.Builder restClientBuilder;
    private final CartServiceProperties cartServiceProperties;

    public CartSnapshot getCart(UUID cartId, UUID userId, UUID townId) {
        RestClient client = restClientBuilder.baseUrl(cartServiceProperties.getBaseUrl()).build();
        ApiResponse<CartSnapshot> response = client.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/carts/{cartId}")
                        .queryParam("userId", userId)
                        .queryParam("townId", townId)
                        .build(cartId))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<CartSnapshot>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Cart service returned empty response");
        }
        return response.getData();
    }

    public void convertCart(UUID cartId, UUID userId, UUID townId) {
        RestClient client = restClientBuilder.baseUrl(cartServiceProperties.getBaseUrl()).build();
        client.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/carts/{cartId}/convert")
                        .queryParam("userId", userId)
                        .queryParam("townId", townId)
                        .build(cartId))
                .retrieve()
                .toBodilessEntity();
    }

    public ReorderCartResult replaceCartItems(UUID userId, UUID townId, java.util.List<ReorderLine> items) {
        RestClient client = restClientBuilder.baseUrl(cartServiceProperties.getBaseUrl()).build();
        java.util.List<java.util.Map<String, Object>> bodyItems = items.stream()
                .map(line -> java.util.Map.<String, Object>of(
                        "listingId", line.listingId(),
                        "quantity", line.quantity()))
                .toList();
        ApiResponse<ReorderCartResult> response = client.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/carts/replace-items")
                        .queryParam("userId", userId)
                        .queryParam("townId", townId)
                        .build())
                .body(java.util.Map.of("items", bodyItems))
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<ReorderCartResult>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Cart reorder failed");
        }
        return response.getData();
    }

    public record ReorderLine(UUID listingId, int quantity) {
    }

    public record ReorderCartResult(
            UUID cartId,
            UUID townId,
            BigDecimal itemsSubtotal,
            int itemCount,
            boolean minOrderMet
    ) {
    }

    public record CartSnapshot(
            UUID cartId,
            UUID userId,
            UUID townId,
            String status,
            BigDecimal itemsSubtotal,
            BigDecimal promoDiscount,
            String promoCode,
            BigDecimal payableSubtotal,
            int itemCount,
            boolean minOrderMet,
            List<CartItemSnapshot> items
    ) {
    }

    public record CartItemSnapshot(
            UUID itemId,
            UUID listingId,
            UUID vendorId,
            UUID shopId,
            UUID masterItemId,
            String itemName,
            String shopName,
            String unitCode,
            int quantity,
            BigDecimal unitPrice,
            BigDecimal discountPrice,
            BigDecimal lineTotal
    ) {
    }
}
