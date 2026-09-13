package com.hyperlocalmart.payment.dto.request;

import lombok.Data;

import java.util.UUID;

@Data
public class ConfirmMembershipCashRequest {

    private UUID purchaseId;
    private String phone;
}
