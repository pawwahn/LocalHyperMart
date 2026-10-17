package com.hyperlocalmart.order.dto.response;

import java.util.UUID;

/** A shop that delivered at least one bag in a town during the scanned window. */
public record DeliveredVendorTown(UUID vendorId, UUID townId) {
}
