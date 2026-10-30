package com.hyperlocalmart.order.client;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.UUID;

/** Sum of SUCCESS gateway payments for an order (excludes visit cash). */
public interface SuccessfulOnlineTotalLookup {

    BigDecimal sumSuccessfulPaymentsForOrder(UUID orderId);

    /** Optional bulk load — default no-op for tests and simple stubs. */
    default void prefetch(Collection<UUID> orderIds) {
    }
}
