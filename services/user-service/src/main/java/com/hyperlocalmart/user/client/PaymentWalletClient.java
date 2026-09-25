package com.hyperlocalmart.user.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.config.PaymentServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class PaymentWalletClient {

    private final RestClient.Builder restClientBuilder;
    private final PaymentServiceProperties paymentServiceProperties;

    public void credit(
            UUID userId,
            BigDecimal amount,
            String referenceType,
            UUID referenceId,
            UUID orderId,
            String note) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
        Map<String, Object> body = new HashMap<>();
        body.put("userId", userId);
        body.put("amount", amount);
        body.put("referenceType", referenceType);
        body.put("referenceId", referenceId);
        body.put("orderId", orderId);
        body.put("note", note != null ? note : "");
        client.post()
                .uri("/api/v1/internal/wallet/credit")
                .body(body)
                .retrieve()
                .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
    }
}
