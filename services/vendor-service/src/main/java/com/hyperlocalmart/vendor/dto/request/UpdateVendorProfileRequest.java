package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateVendorProfileRequest {

    @NotBlank
    @Size(max = 255)
    private String businessName;

    @Size(max = 255)
    private String ownerName;

    @NotBlank
    @Size(max = 255)
    private String shopName;

    private String address;

    @Size(max = 20)
    private String gstNumber;

    @Size(max = 32)
    private String fssaiNumber;

    private String bankAccount;

    @Size(max = 20)
    private String ifsc;
}
