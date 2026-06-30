package com.hyperlocalmart.delivery.client;

import com.hyperlocalmart.delivery.config.NotificationServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class NotificationClient {

    private final RestClient.Builder restClientBuilder;
    private final NotificationServiceProperties notificationServiceProperties;

    public void notifyOutForDelivery(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                     String orderNumber, String otp) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("otp", otp);
        send("OUT_FOR_DELIVERY", townId, orderId, buyerId, buyerPhone, params);
    }

    private void send(String eventCode, UUID townId, UUID orderId, UUID recipientUserId,
                      String recipientPhone, Map<String, String> params) {
        try {
            RestClient client = restClientBuilder.baseUrl(notificationServiceProperties.getBaseUrl()).build();
            Map<String, Object> body = new HashMap<>();
            body.put("eventCode", eventCode);
            body.put("channel", "SMS");
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
            log.warn("Notification {} failed for order {}: {}", eventCode, orderId, ex.getMessage());
        }
    }
}
