package com.hyperlocalmart.order.client;

import com.hyperlocalmart.order.config.RestClientFactory;
import com.hyperlocalmart.order.config.UserServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.UUID;

@Slf4j
@Component
@RequiredArgsConstructor
public class UserReferralClient {

    private final RestClientFactory restClients;
    private final UserServiceProperties userServiceProperties;

    public void onOrderDelivered(UUID buyerId, UUID orderId) {
        try {
            RestClient client = restClients.forBaseUrl(userServiceProperties.getBaseUrl());
            client.post()
                    .uri("/api/v1/internal/referrals/order-delivered")
                    .body(Map.of("buyerId", buyerId, "orderId", orderId))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception ex) {
            log.warn("Referral reward hook failed for order {}: {}", orderId, ex.getMessage());
        }
    }
}
