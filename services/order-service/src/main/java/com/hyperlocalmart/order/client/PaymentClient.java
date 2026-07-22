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
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("orderId", orderId);
        body.put("amount", amount != null ? amount : BigDecimal.ZERO);
        body.put("reason", reason != null ? reason : "");
        client.post()
                .uri(uriBuilder -> uriBuilder
                        .path("/api/v1/internal/payments/refunds")
                        .queryParam("buyerId", buyerId)
                        .build())
                .body(body)
                .retrieve()
                .toBodilessEntity();
    }

    /**
     * Full refund of the successful gateway capture, if any.
     * Uses payment-service captured amount (not shrunk order.totalAmount).
     * @return refunded amount, or ZERO when no SUCCESS payment exists
     */
    public BigDecimal refundSuccessfulPaymentIfAny(UUID orderId, UUID buyerId, String reason) {
        try {
            RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
            Map<String, Object> body = new java.util.HashMap<>();
            body.put("orderId", orderId);
            body.put("amount", BigDecimal.ZERO); // ignored — payment-service refunds capture amount
            body.put("reason", reason != null ? reason : "");
            ApiResponse<RefundResult> response = client.post()
                    .uri(uriBuilder -> uriBuilder
                            .path("/api/v1/internal/payments/refunds")
                            .queryParam("buyerId", buyerId)
                            .build())
                    .body(body)
                    .retrieve()
                    .body(new ParameterizedTypeReference<ApiResponse<RefundResult>>() {});
            if (response == null || response.getData() == null || response.getData().amount() == null) {
                return BigDecimal.ZERO;
            }
            return response.getData().amount();
        } catch (RestClientResponseException ex) {
            String payload = ex.getResponseBodyAsString();
            if (ex.getStatusCode().value() == 404
                    || (payload != null && payload.toLowerCase().contains("successful payment not found"))) {
                return BigDecimal.ZERO;
            }
            throw new IllegalStateException("Refund failed: " + ex.getMessage(), ex);
        }
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

    /**
     * Debit vendor future payout by the claim credit amount (idempotent on claimId).
     */
    public void recordVendorClaimChargeback(
            UUID townId,
            UUID vendorId,
            UUID shopId,
            UUID claimId,
            UUID orderId,
            String orderNumber,
            UUID orderItemId,
            UUID subOrderId,
            BigDecimal amount,
            String reason) {
        RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new java.util.HashMap<>();
        body.put("townId", townId);
        body.put("vendorId", vendorId);
        body.put("shopId", shopId);
        body.put("claimId", claimId);
        body.put("orderId", orderId);
        body.put("orderNumber", orderNumber);
        body.put("orderItemId", orderItemId);
        body.put("subOrderId", subOrderId);
        body.put("amount", amount);
        body.put("reason", reason != null ? reason : "");
        try {
            client.post()
                    .uri("/api/v1/internal/settlements/vendor-adjustments")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (RestClientResponseException ex) {
            throw new IllegalStateException("Vendor claim chargeback failed: " + ex.getMessage(), ex);
        }
    }

    public record PaymentInitiateResult(UUID paymentId, UUID orderId, String status, String upiIntent, String qrPayload) {
    }

    public record WalletBalanceResult(UUID userId, BigDecimal balance, String status) {
    }

    public record RefundResult(UUID refundId, UUID paymentId, UUID orderId, BigDecimal amount, String status) {
    }
}
