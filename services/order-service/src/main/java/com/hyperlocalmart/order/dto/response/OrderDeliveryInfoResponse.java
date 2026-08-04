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
    /** Snapshot fields for last-mile agents. */
    String recipientName;
    String recipientPhone;
    String addressLine1;
    String addressLine2;
    String landmark;
    String pincode;
    String addressLabel;
}
