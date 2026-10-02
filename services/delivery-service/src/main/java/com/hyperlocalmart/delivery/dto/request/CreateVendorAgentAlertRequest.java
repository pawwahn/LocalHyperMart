package com.hyperlocalmart.delivery.dto.request;

import lombok.Data;

import java.util.UUID;

@Data
public class CreateVendorAgentAlertRequest {

    private UUID vendorId;
    private UUID actorUserId;
}
