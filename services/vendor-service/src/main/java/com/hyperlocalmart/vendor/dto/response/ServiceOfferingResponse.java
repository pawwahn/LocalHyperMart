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
}
