package com.hyperlocalmart.payment.razorpay;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.PaymentProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.client.ResourceAccessException;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
@RequiredArgsConstructor
public class RazorpayClient {

    private final PaymentProperties paymentProperties;
    private final ObjectMapper objectMapper;

    public boolean isConfigured() {
        return paymentProperties.isRazorpayConfigured();
    }

    public RazorpayOrder createOrder(long amountPaise, String receipt, Map<String, String> notes) {
        if (!isConfigured()) {
            return new RazorpayOrder(stubId("order"), amountPaise, "INR");
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", amountPaise);
        body.put("currency", "INR");
        body.put("receipt", trimReceipt(receipt));
        if (notes != null && !notes.isEmpty()) {
            body.put("notes", notes);
        }
        JsonNode node = post("/orders", body);
        return new RazorpayOrder(
                text(node, "id"),
                node.path("amount").asLong(amountPaise),
                text(node, "currency")
        );
    }

    public RazorpayPayment fetchPayment(String paymentId) {
        if (!isConfigured()) {
            return new RazorpayPayment(paymentId, null, "captured", 0L);
        }
        JsonNode node = get("/payments/" + paymentId);
        return new RazorpayPayment(
                text(node, "id"),
                node.path("order_id").asText(null),
                text(node, "status"),
                node.path("amount").asLong(0L)
        );
    }

    public RazorpayRefund refund(String gatewayPaymentId, long amountPaise, String reason) {
        if (!isConfigured()) {
            return new RazorpayRefund(stubId("rfnd"), "processed", amountPaise);
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("amount", amountPaise);
        if (reason != null && !reason.isBlank()) {
            body.put("notes", Map.of("reason", reason.substring(0, Math.min(reason.length(), 256))));
        }
        JsonNode node = post("/payments/" + gatewayPaymentId + "/refund", body);
        return new RazorpayRefund(
                text(node, "id"),
                text(node, "status"),
                node.path("amount").asLong(amountPaise)
        );
    }

    private JsonNode get(String path) {
        try {
            String json = client().get()
                    .uri(path)
                    .retrieve()
                    .body(String.class);
            return read(json);
        } catch (RestClientResponseException ex) {
            throw razorpayError(ex);
        } catch (ResourceAccessException ex) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "Payment gateway unreachable. Try cash on delivery, or retry in a moment.");
        }
    }

    private JsonNode post(String path, Map<String, Object> body) {
        try {
            String json = client().post()
                    .uri(path)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body)
                    .retrieve()
                    .body(String.class);
            return read(json);
        } catch (RestClientResponseException ex) {
            throw razorpayError(ex);
        } catch (ResourceAccessException ex) {
            throw new BusinessException(
                    ErrorCode.CONFLICT,
                    "Payment gateway unreachable. Try cash on delivery, or retry in a moment.");
        }
    }

    private RestClient client() {
        String token = Base64.getEncoder().encodeToString(
                (paymentProperties.getRazorpayKeyId() + ":" + paymentProperties.getRazorpayKeySecret())
                        .getBytes(StandardCharsets.UTF_8));
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(Duration.ofSeconds(20));
        return RestClient.builder()
                .baseUrl(paymentProperties.getRazorpayApiBaseUrl())
                .requestFactory(requestFactory)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + token)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    private JsonNode read(String json) {
        try {
            return objectMapper.readTree(json == null ? "{}" : json);
        } catch (Exception ex) {
            throw new IllegalStateException("Invalid Razorpay response", ex);
        }
    }

    private static String text(JsonNode node, String field) {
        String value = node.path(field).asText(null);
        if (value == null || value.isBlank()) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Razorpay response missing " + field);
        }
        return value;
    }

    private BusinessException razorpayError(RestClientResponseException ex) {
        String description = ex.getStatusText();
        try {
            JsonNode error = objectMapper.readTree(ex.getResponseBodyAsString()).path("error");
            if (error.hasNonNull("description")) {
                description = error.get("description").asText(description);
            }
        } catch (Exception ignored) {
            // keep status text
        }
        return new BusinessException(ErrorCode.CONFLICT, "Razorpay: " + description);
    }

    private static String stubId(String prefix) {
        return prefix + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
    }

    private static String trimReceipt(String receipt) {
        if (receipt == null) {
            return UUID.randomUUID().toString().replace("-", "");
        }
        return receipt.length() <= 40 ? receipt : receipt.substring(0, 40);
    }
}
