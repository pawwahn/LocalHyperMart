package com.hyperlocalmart.order.client;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.config.PaymentServiceProperties;
import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

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

    public BigDecimal getWalletBalance(UUID userId) {
        RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
        ApiResponse<WalletBalanceResult> response = client.get()
                .uri("/api/v1/internal/wallet/{userId}", userId)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<WalletBalanceResult>>() {});
        if (response == null || response.getData() == null || response.getData().balance() == null) {
            return BigDecimal.ZERO;
        }
        return response.getData().balance();
    }

    public BigDecimal creditWallet(UUID userId, BigDecimal amount, String referenceType, UUID referenceId,
                                   UUID orderId, UUID orderItemId, String note) {
        RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("userId", userId);
        body.put("amount", amount);
        body.put("referenceType", referenceType);
        body.put("referenceId", referenceId);
        body.put("orderId", orderId);
        body.put("orderItemId", orderItemId);
        body.put("note", note != null ? note : "");
        ApiResponse<WalletBalanceResult> response = client.post()
                .uri("/api/v1/internal/wallet/credit")
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<WalletBalanceResult>>() {});
        if (response == null || response.getData() == null || response.getData().balance() == null) {
            throw new IllegalStateException("Wallet credit failed");
        }
        return response.getData().balance();
    }

    public BigDecimal debitWallet(UUID userId, BigDecimal amount, String referenceType, UUID referenceId,
                                  UUID orderId, String note) {
        RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("userId", userId);
        body.put("amount", amount);
        body.put("referenceType", referenceType);
        body.put("referenceId", referenceId);
        body.put("orderId", orderId);
        body.put("note", note != null ? note : "");
        try {
            ApiResponse<WalletBalanceResult> response = client.post()
                    .uri("/api/v1/internal/wallet/debit")
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<WalletBalanceResult>>() {});
            if (response == null || response.getData() == null || response.getData().balance() == null) {
                throw new IllegalStateException("Wallet debit failed");
            }
            return response.getData().balance();
        } catch (RestClientResponseException ex) {
            String payload = ex.getResponseBodyAsString();
            if (payload != null && payload.toLowerCase().contains("insufficient")) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Insufficient store credit");
            }
            throw new IllegalStateException("Wallet debit failed: " + ex.getMessage(), ex);
        }
    }

    public record PaymentInitiateResult(UUID paymentId, UUID orderId, String status, String upiIntent, String qrPayload) {
    }

    public record WalletBalanceResult(UUID userId, BigDecimal balance, String status) {
    }
}
