package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class VendorShopStatusResponse {

    UUID vendorId;
    UUID townId;
    UUID shopId;
    String shopName;
    String address;
    String pincode;
    String phone;
    boolean acceptingOrders;
    String hubName;
    String hubPhone;
    String hubHours;
}
