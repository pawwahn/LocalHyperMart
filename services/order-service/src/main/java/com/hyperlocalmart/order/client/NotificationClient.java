package com.hyperlocalmart.order.client;

import com.hyperlocalmart.order.config.NotificationServiceProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
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

    public void notifyOrderPlaced(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                  String orderNumber, BigDecimal totalAmount) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("totalAmount", totalAmount.toPlainString());
        send("ORDER_PLACED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyOrderCancelled(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                     String orderNumber, String reason) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("reason", reason == null || reason.isBlank() ? "Cancelled" : reason);
        send("ORDER_CANCELLED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyRefundInitiated(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                      String orderNumber, BigDecimal amount, int workingDays) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("amount", amount.toPlainString());
        params.put("workingDays", String.valueOf(workingDays));
        send("REFUND_INITIATED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifySubOrderReady(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                    String orderNumber, String shopName) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("shopName", shopName == null || shopName.isBlank() ? "your shop" : shopName);
        send("SUB_ORDER_READY", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyOrderDelivered(UUID townId, UUID orderId, UUID buyerId, String buyerPhone, String orderNumber) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        send("ORDER_DELIVERED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyPaymentFailed(UUID townId, UUID orderId, UUID buyerId, String buyerPhone, String orderNumber) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        send("PAYMENT_FAILED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyItemCancelledStoreCredit(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                               String orderNumber, String itemName, BigDecimal amount,
                                               BigDecimal balance) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("itemName", itemName);
        params.put("amount", amount.toPlainString());
        params.put("balance", balance.toPlainString());
        send("ITEM_CANCELLED_STORE_CREDIT", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyItemRestored(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                   String orderNumber, String itemName, BigDecimal amount) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("itemName", itemName);
        params.put("amount", amount.toPlainString());
        send("ITEM_RESTORED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyClaimOpened(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                  String orderNumber, String claimType, String itemName) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("claimType", claimType);
        params.put("itemName", itemName == null || itemName.isBlank() ? "your order" : itemName);
        send("CLAIM_OPENED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyClaimResolved(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                    String orderNumber, BigDecimal amount, String itemName) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("amount", amount == null ? "0" : amount.toPlainString());
        params.put("itemName", itemName == null || itemName.isBlank() ? "your order" : itemName);
        send("CLAIM_RESOLVED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyClaimRejected(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                    String orderNumber, String reason) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("reason", reason == null || reason.isBlank() ? "Not eligible" : reason);
        send("CLAIM_REJECTED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyItemRemovedCodReduced(UUID townId, UUID orderId, UUID buyerId, String buyerPhone,
                                            String orderNumber, String itemName, BigDecimal newTotal) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("itemName", itemName == null || itemName.isBlank() ? "items" : itemName);
        params.put("newTotal", newTotal == null ? "0" : newTotal.toPlainString());
        send("ITEM_REMOVED_COD_REDUCED", townId, orderId, buyerId, buyerPhone, params);
    }

    public void notifyVendorShopRejected(UUID townId, UUID recipientUserId, String recipientPhone,
                                         UUID orderId, String orderNumber, String shopName,
                                         BigDecimal amount, String reason, String buyerPhone) {
        Map<String, String> params = new HashMap<>();
        params.put("orderNumber", orderNumber);
        params.put("shopName", shopName == null || shopName.isBlank() ? "a shop" : shopName);
        params.put("amount", amount == null ? "0" : amount.toPlainString());
        params.put("reason", reason == null || reason.isBlank() ? "Rejected" : reason);
        params.put("buyerPhone", buyerPhone == null ? "" : buyerPhone);
        send("VENDOR_SHOP_REJECTED", townId, orderId, recipientUserId, recipientPhone, params);
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
