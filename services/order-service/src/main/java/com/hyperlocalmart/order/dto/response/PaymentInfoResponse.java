package com.hyperlocalmart.order.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class PaymentInfoResponse {

    private UUID paymentId;
    private String status;
    private String upiIntent;
    private String qrPayload;
}
