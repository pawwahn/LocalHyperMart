package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class ShopSummaryResponse {

    private UUID id;
    private UUID vendorId;
    private String shopName;
    private String address;
    private String pincode;
    private String phone;
}
