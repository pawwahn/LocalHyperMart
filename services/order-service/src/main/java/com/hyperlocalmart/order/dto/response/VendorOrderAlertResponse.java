package com.hyperlocalmart.order.dto.response;

import com.hyperlocalmart.order.entity.VendorOrderAlertStatus;
import lombok.Builder;
import lombok.Value;

import java.time.Instant;
import java.util.UUID;

@Value
@Builder
public class VendorOrderAlertResponse {
    UUID alertId;
    UUID orderId;
    String orderNumber;
    UUID subOrderId;
    String subOrderNumber;
    UUID vendorId;
    UUID shopId;
    String shopName;
    UUID townId;
    VendorOrderAlertStatus status;
    String message;
    Instant createdAt;
    Instant acknowledgedAt;
}
