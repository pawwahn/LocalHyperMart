package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class VendorRegistrationResponse {

    private UUID id;
    private UUID townId;
    private String businessName;
    private String ownerName;
    private String phone;
    private String shopName;
    private String address;
    private String gstNumber;
    private String fssaiNumber;
    private String status;
    private String rejectReason;
    private UUID vendorId;
    private Instant createdAt;
    private String temporaryPassword;
}
