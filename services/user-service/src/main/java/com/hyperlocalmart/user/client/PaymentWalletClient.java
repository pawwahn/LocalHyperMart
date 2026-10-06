package com.hyperlocalmart.user.client;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.user.config.PaymentServiceProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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

    /** Key = referenceType + "|" + referenceId. Empty map if payment-service is down. */
    public Map<String, BigDecimal> lookupCredits(List<String> referenceTypes, List<UUID> referenceIds) {
        Map<String, BigDecimal> out = new HashMap<>();
        if (referenceIds == null || referenceIds.isEmpty() || referenceTypes == null || referenceTypes.isEmpty()) {
            return out;
        }
        try {
            RestClient client = restClientBuilder.baseUrl(paymentServiceProperties.getBaseUrl()).build();
            int from = 0;
            while (from < referenceIds.size()) {
                int to = Math.min(from + 400, referenceIds.size());
                Map<String, Object> body = new HashMap<>();
                body.put("referenceTypes", referenceTypes);
                body.put("referenceIds", new ArrayList<>(referenceIds.subList(from, to)));
                ApiResponse<Map<String, Object>> response = client.post()
                        .uri("/api/v1/internal/wallet/credits/lookup")
                        .body(body)
                        .retrieve()
                        .body(new ParameterizedTypeReference<ApiResponse<Map<String, Object>>>() {});
                Object data = response == null ? null : response.getData();
                if (data instanceof Map<?, ?> map) {
                    Object items = map.get("items");
                    if (items instanceof List<?> list) {
                        for (Object row : list) {
                            if (!(row instanceof Map<?, ?> item)) {
                                continue;
                            }
                            Object type = item.get("referenceType");
                            Object id = item.get("referenceId");
                            if (type == null || id == null) {
                                continue;
                            }
                            out.put(type + "|" + id, money(item.get("amount")));
                        }
                    }
                }
                from = to;
            }
        } catch (Exception ignored) {
            return Map.of();
        }
        return out;
    }

    private static BigDecimal money(Object raw) {
        if (raw instanceof Number n) {
            return BigDecimal.valueOf(n.doubleValue());
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new BigDecimal(s.trim());
        }
        return BigDecimal.ZERO;
    }
}
