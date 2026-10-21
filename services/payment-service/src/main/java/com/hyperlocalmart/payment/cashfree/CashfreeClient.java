package com.hyperlocalmart.payment.cashfree;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.PaymentProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class CashfreeClient {

    private final PaymentProperties paymentProperties;
    private final ObjectMapper objectMapper;

    public record CreatedOrder(String orderId, String paymentSessionId) {
    }

    public record PaidOrder(String paymentId) {
    }

    public CreatedOrder createOrder(String orderId, BigDecimal amount, String phone, String customerId) {
        Map<String, Object> customer = new LinkedHashMap<>();
        customer.put("customer_id", trimId(customerId));
        customer.put("customer_phone", digits(phone));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("order_id", orderId);
        body.put("order_amount", amount.setScale(2, RoundingMode.HALF_UP));
        body.put("order_currency", "INR");
        body.put("customer_details", customer);
        JsonNode node = post("/orders", body);
        String session = text(node, "payment_session_id");
        if (session == null || session.isBlank()) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cashfree did not return a payment session");
        }
        return new CreatedOrder(text(node, "order_id") == null ? orderId : text(node, "order_id"), session);
    }

    public PaidOrder requirePaid(String orderId) {
        JsonNode node = get("/orders/" + orderId);
        String status = text(node, "order_status");
        if (!"PAID".equalsIgnoreCase(status)) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cashfree payment is not complete yet");
        }
        String paymentId = null;
        try {
            JsonNode payments = get("/orders/" + orderId + "/payments");
            if (payments.isArray()) {
                for (JsonNode payment : payments) {
                    if ("SUCCESS".equalsIgnoreCase(text(payment, "payment_status"))) {
                        paymentId = text(payment, "cf_payment_id");
                        break;
                    }
                }
            }
        } catch (BusinessException ignored) {
            paymentId = null;
        }
        return new PaidOrder(paymentId);
    }

    public String refund(String orderId, BigDecimal amount, String refundId, String note) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("refund_amount", amount.setScale(2, RoundingMode.HALF_UP));
        body.put("refund_id", trimId(refundId));
        if (note != null && !note.isBlank()) {
            body.put("refund_note", note.substring(0, Math.min(note.length(), 100)));
        }
        JsonNode node = post("/orders/" + orderId + "/refunds", body);
        String id = text(node, "cf_refund_id");
        return id == null || id.isBlank() ? text(node, "refund_id") : id;
    }

    private JsonNode get(String path) {
        try {
            String json = client().get().uri(path).retrieve().body(String.class);
            return read(json);
        } catch (RestClientResponseException ex) {
            throw gatewayError(ex);
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
            throw gatewayError(ex);
        }
    }

    private RestClient client() {
        return RestClient.builder()
                .baseUrl(trimSlash(paymentProperties.getCashfreeApiBaseUrl()))
                .defaultHeader("x-client-id", paymentProperties.getCashfreeClientId())
                .defaultHeader("x-client-secret", paymentProperties.getCashfreeClientSecret())
                .defaultHeader("x-api-version", paymentProperties.getCashfreeApiVersion())
                .build();
    }

    private JsonNode read(String json) {
        try {
            return objectMapper.readTree(json == null ? "{}" : json);
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.CONFLICT, "Cashfree returned an unreadable response");
        }
    }

    private static BusinessException gatewayError(RestClientResponseException ex) {
        String message = ex.getResponseBodyAsString();
        if (message != null && message.length() > 180) {
            message = message.substring(0, 180);
        }
        if (message == null || message.isBlank()) {
            message = "Cashfree rejected the payment request";
        }
        return new BusinessException(ErrorCode.CONFLICT, message);
    }

    private static String text(JsonNode node, String field) {
        if (node == null || node.path(field).isMissingNode() || node.path(field).isNull()) {
            return null;
        }
        String value = node.path(field).asText();
        return value == null || value.isBlank() ? null : value;
    }

    private static String digits(String phone) {
        String raw = phone == null ? "" : phone.replaceAll("\\D", "");
        if (raw.length() > 10) {
            raw = raw.substring(raw.length() - 10);
        }
        if (raw.length() != 10) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "A 10-digit phone number is required for Cashfree");
        }
        return raw;
    }

    private static String trimId(String value) {
        String raw = value == null ? "" : value.replace("-", "");
        return raw.length() > 40 ? raw.substring(0, 40) : raw;
    }

    private static String trimSlash(String value) {
        if (value == null || value.isBlank()) {
            return "https://sandbox.cashfree.com/pg";
        }
        return value.endsWith("/") ? value.substring(0, value.length() - 1) : value;
    }
}
