package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateShopProfileRequest {

    @Size(min = 2, max = 120)
    private String shopName;

    @Size(max = 255)
    private String address;

    @Pattern(regexp = "^$|^\\d{6}$", message = "Pincode must be 6 digits")
    private String pincode;
}
