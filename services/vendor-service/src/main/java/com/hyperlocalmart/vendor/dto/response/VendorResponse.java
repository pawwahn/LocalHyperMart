package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class VendorResponse {

    private UUID id;
    private UUID townId;
    private String businessName;
    private String ownerName;
    private String phone;
    private String gstNumber;
    private String fssaiNumber;
    private String bankAccount;
    private String ifsc;
    private String status;
    private String shopName;
    private String address;
    private String disabledReason;
}
