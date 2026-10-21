package com.hyperlocalmart.payment.phonepe;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.config.PaymentProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class PhonePeClient {

    private final PaymentProperties paymentProperties;
    private final ObjectMapper objectMapper;

    private volatile String accessToken;
    private volatile Instant accessTokenUntil = Instant.EPOCH;

    public record CreatedCheckout(String merchantOrderId, String redirectUrl) {
    }

    public record CompletedOrder(String transactionId) {
    }

    public CreatedCheckout createCheckout(String merchantOrderId, long amountPaise) {
        Map<String, Object> urls = new LinkedHashMap<>();
        urls.put("redirectUrl", paymentProperties.getPaymentReturnUrl());
        Map<String, Object> flow = new LinkedHashMap<>();
        flow.put("type", "PG_CHECKOUT");
        flow.put("merchantUrls", urls);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("merchantOrderId", merchantOrderId);
        body.put("amount", amountPaise);
        body.put("paymentFlow", flow);
        JsonNode node = post(payBase() + "/checkout/v2/pay", body, true);
        String redirect = text(node, "redirectUrl");
        if (redirect == null) {
            throw new BusinessException(ErrorCode.CONFLICT, "PhonePe did not return a checkout link");
        }
        return new CreatedCheckout(merchantOrderId, redirect);
    }

    public CompletedOrder requireCompleted(String merchantOrderId) {
        JsonNode node = get(payBase() + "/checkout/v2/order/" + merchantOrderId + "/status");
        if (!"COMPLETED".equalsIgnoreCase(text(node, "state"))) {
            throw new BusinessException(ErrorCode.CONFLICT, "PhonePe payment is not complete yet");
        }
        String transactionId = null;
        JsonNode details = node.path("paymentDetails");
        if (details.isArray() && !details.isEmpty()) {
            transactionId = text(details.get(0), "transactionId");
        }
        return new CompletedOrder(transactionId);
    }

    public String refund(String merchantOrderId, long amountPaise, String refundId) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("merchantRefundId", refundId);
        body.put("originalMerchantOrderId", merchantOrderId);
        body.put("amount", amountPaise);
        JsonNode node = post(payBase() + "/payments/v2/refund", body, true);
        String id = text(node, "refundId");
        return id == null ? refundId : id;
    }

    public void clearAccessToken() {
        accessToken = null;
        accessTokenUntil = Instant.EPOCH;
    }

    private String token() {
        if (accessToken != null && Instant.now().isBefore(accessTokenUntil)) {
            return accessToken;
        }
        synchronized (this) {
            if (accessToken != null && Instant.now().isBefore(accessTokenUntil)) {
                return accessToken;
            }
            LinkedMultiValueMap<String, String> form = new LinkedMultiValueMap<>();
            form.add("client_id", paymentProperties.getPhonepeClientId());
            form.add("client_version", paymentProperties.getPhonepeClientVersion());
            form.add("client_secret", paymentProperties.getPhonepeClientSecret());
            form.add("grant_type", "client_credentials");
            try {
                String json = RestClient.builder()
                        .baseUrl(authUrl())
                        .build()
                        .post()
                        .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                        .body(form)
                        .retrieve()
                        .body(String.class);
                JsonNode node = objectMapper.readTree(json == null ? "{}" : json);
                String token = text(node, "access_token");
                if (token == null) {
                    throw new BusinessException(ErrorCode.CONFLICT, "PhonePe did not return an access token");
                }
                long expiresIn = node.path("expires_in").asLong(0);
                if (expiresIn <= 0 && node.path("expires_at").isNumber()) {
                    long epoch = node.path("expires_at").asLong();
                    expiresIn = Math.max(60, epoch - Instant.now().getEpochSecond());
                }
                if (expiresIn <= 0) {
                    expiresIn = 300;
                }
                accessToken = token;
                accessTokenUntil = Instant.now().plusSeconds(Math.max(30, expiresIn - 30));
                return token;
            } catch (BusinessException ex) {
                throw ex;
            } catch (RestClientResponseException ex) {
                throw gatewayError(ex);
            } catch (Exception ex) {
                throw new BusinessException(ErrorCode.CONFLICT, "PhonePe login failed");
            }
        }
    }

    private JsonNode get(String url) {
        try {
            String json = RestClient.builder().build().get()
                    .uri(url)
                    .header("Authorization", "O-Bearer " + token())
                    .retrieve()
                    .body(String.class);
            return objectMapper.readTree(json == null ? "{}" : json);
        } catch (RestClientResponseException ex) {
            throw gatewayError(ex);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.CONFLICT, "PhonePe returned an unreadable response");
        }
    }

    private JsonNode post(String url, Map<String, Object> body, boolean authorized) {
        try {
            var spec = RestClient.builder().build().post().uri(url).contentType(MediaType.APPLICATION_JSON);
            if (authorized) {
                spec = spec.header("Authorization", "O-Bearer " + token());
            }
            String json = spec.body(body).retrieve().body(String.class);
            return objectMapper.readTree(json == null ? "{}" : json);
        } catch (RestClientResponseException ex) {
            throw gatewayError(ex);
        } catch (BusinessException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.CONFLICT, "PhonePe returned an unreadable response");
        }
    }

    private String authUrl() {
        if (paymentProperties.isPhonePeSandbox()) {
            return "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token";
        }
        return "https://api.phonepe.com/apis/identity-manager/v1/oauth/token";
    }

    private String payBase() {
        if (paymentProperties.isPhonePeSandbox()) {
            return "https://api-preprod.phonepe.com/apis/pg-sandbox";
        }
        return "https://api.phonepe.com/apis/pg";
    }

    private static BusinessException gatewayError(RestClientResponseException ex) {
        String message = ex.getResponseBodyAsString();
        if (message != null && message.length() > 180) {
            message = message.substring(0, 180);
        }
        if (message == null || message.isBlank()) {
            message = "PhonePe rejected the payment request";
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
}
