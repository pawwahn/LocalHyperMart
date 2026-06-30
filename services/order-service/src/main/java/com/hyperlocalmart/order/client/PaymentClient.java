package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.PaymentServiceProperties;
import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PaymentClient {

    private final RestClient.Builder restClientBuilder;
    private final PaymentServiceProperties paymentServiceProperties;

    public PaymentInfoResponse initiatePayment(UUID buyerId, UUID orderId, UUID townId, String gateway, String idempotencyKey) {
        RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = Map.of(
                "orderId", orderId,
                "townId", townId,
                "gateway", gateway != null ? gateway : "RAZORPAY"
        );
        ApiResponse<PaymentInitiateResult> response = client.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/payments/initiate")
                        .queryParam("buyerId", buyerId)
                        .build())
                .header("Idempotency-Key", idempotencyKey != null ? idempotencyKey : UUID.randomUUID().toString())
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<PaymentInitiateResult>>() {});
        if (response == null || response.getData() == null) {
            throw new IllegalStateException("Payment initiation failed");
        }
        PaymentInitiateResult data = response.getData();
        return PaymentInfoResponse.builder()
                .paymentId(data.paymentId())
                .status(data.status())
                .upiIntent(data.upiIntent())
                .qrPayload(data.qrPayload())
                .build();
    }

    public void initiateRefund(UUID orderId, UUID buyerId, BigDecimal amount, String reason) {
        RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = Map.of(
                "orderId", orderId,
                "amount", amount,
                "reason", reason != null ? reason : ""
        );
        client.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/payments/refunds")
                        .queryParam("buyerId", buyerId)
                        .build())
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    public record PaymentInitiateResult(UUID paymentId, UUID orderId, String status, String upiIntent, String qrPayload) {
    }
}
