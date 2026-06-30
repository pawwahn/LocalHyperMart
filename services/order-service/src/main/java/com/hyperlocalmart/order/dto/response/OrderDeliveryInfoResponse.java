package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class OrderDeliveryInfoResponse {

    UUID orderId;
    UUID buyerId;
    UUID townId;
    String status;
    String orderNumber;
    String buyerPhone;
}
