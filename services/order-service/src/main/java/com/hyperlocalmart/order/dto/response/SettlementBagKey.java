package com.hyperlocalmart.order.dto.response;

import java.util.UUID;

/** One delivered bag in a settlement window, without the order payload. */
public record SettlementBagKey(UUID vendorId, UUID townId, UUID subOrderId) {
}
