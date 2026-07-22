package com.hyperlocalmart.delivery.client;

import com.hyperlocalmart.delivery.config.NotificationServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationClient {

    private static final List<String> CHANNELS = List.of("SMS", "PUSH");

    private final RestClient.Builder restClientBuilder;
    private final NotificationServiceProperties notificationServiceProperties;

    public void notifyOutForDelivery(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                     String orderNumber, String otp) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("otp", otp);
        send("OUT_FOR_DELIVERY", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyOrderAtHub(UUID townId, UUID orderId, UUID buyerId, String buyerPhone, String orderNumber) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        send("ORDER_AT_HUB", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyBuyerRejected(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                    String orderNumber, String reason) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("reason", reason == null || reason.isBlank() ? "Rejected at door" : reason);
        send("BUYER_REJECTED", townId, orderId, buyerId, buyerPhone, params);
    }

    private void send(String eventCode, UUID townId, UUID orderId, UUID recipientUserId,
                      String recipientPhone, Map<String, String> params) {
        for (String channel : CHANNELS) {
            sendChannel(eventCode, channel, townId, orderId, recipientUserId, recipientPhone, params);
        }
    }

    private void sendChannel(String eventCode, String channel, UUID townId, UUID orderId, UUID recipientUserId,
                             String recipientPhone, Map<String, String> params) {
        try {
            RestClient client = restClientBuilder.baseUrl(notificationServiceProperties.getBaseUrl()).build();
            Map<String, Object> body = new HashMap<>();
            body.put("eventCode", eventCode);
            body.put("channel", channel);
            body.put("townId", townId);
            body.put("orderId", orderId);
            body.put("recipientUserId", recipientUserId);
            body.put("recipientPhone", recipientPhone);
            body.put("params", params);
            client.post()
                    .uri("/api/v1/internal/notifications/send")
                    .body(body)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ex) {
            log.warn("Notification {}/{} failed for order {}: {}", eventCode, channel, orderId, ex.getMessage());
        }
    }
}
