package com.hyperlocalmart.delivery.dto.request;

import lombok.Data;

import java.util.UUID;

@Data
public class AssignVendorDirectInternalRequest {
    private UUID vendorId;
    private UUID agentId;
    private UUID assignedBy;
}
