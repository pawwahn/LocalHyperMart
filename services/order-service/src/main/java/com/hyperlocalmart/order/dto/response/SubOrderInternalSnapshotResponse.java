package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class SubOrderInternalSnapshotResponse {

    UUID subOrderId;
    String subOrderNumber;
    UUID orderId;
    UUID townId;
    UUID vendorId;
    String status;
    String orderNumber;
}
