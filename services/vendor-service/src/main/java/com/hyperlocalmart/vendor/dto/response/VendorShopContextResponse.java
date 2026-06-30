package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class VendorShopContextResponse {

    UUID vendorId;
    UUID townId;
    UUID shopId;
    String shopName;
}
