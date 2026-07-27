package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class VendorMeResponse {

    private UUID vendorId;
    private UUID townId;
    private String businessName;
    private String phone;
    private String shopName;
    private UUID shopId;
    private String status;
}
