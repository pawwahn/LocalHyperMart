package com.hyperlocalmart.order.client;

import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;
import org.springframework.web.context.annotation.RequestScope;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** One batch call to payment-service per request instead of one HTTP round-trip per glam order. */
@Component
@Primary
@RequestScope
public class CachedOnlinePaymentLookup implements SuccessfulOnlineTotalLookup {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final PaymentClient paymentClient;
    private final Map<UUID, BigDecimal> cache = new HashMap<>();

    public CachedOnlinePaymentLookup(PaymentClient paymentClient) {
        this.paymentClient = paymentClient;
    }

    @Override
    public void prefetch(Collection<UUID> orderIds) {
        if (orderIds == null || orderIds.isEmpty()) {
            return;
        }
        var missing = orderIds.stream().filter(id -> id != null && !cache.containsKey(id)).distinct().toList();
        if (missing.isEmpty()) {
            return;
        }
        Map<UUID, BigDecimal> batch = paymentClient.sumSuccessfulPaymentsForOrders(missing);
        for (UUID id : missing) {
            BigDecimal amount = batch.get(id);
            cache.put(id, amount == null ? ZERO : amount);
        }
    }

    @Override
    public BigDecimal sumSuccessfulPaymentsForOrder(UUID orderId) {
        if (orderId == null) {
            return ZERO;
        }
        if (cache.containsKey(orderId)) {
            return cache.get(orderId);
        }
        prefetch(java.util.List.of(orderId));
        return cache.getOrDefault(orderId, ZERO);
    }
}
