package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ServiceOfferingResponse {

    private UUID id;
    private String name;
    private boolean hidesListings;
    private int sortOrder;
    /** Active vendors assigned to this service. */
    private long vendorCount;
    /** Pending registration requests still referencing this service. */
    private long pendingRegistrationCount;
}
