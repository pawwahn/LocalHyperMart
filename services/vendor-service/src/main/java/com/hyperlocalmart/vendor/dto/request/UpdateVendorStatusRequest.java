package com.hyperlocalmart.vendor.dto.request;

import com.hyperlocalmart.vendor.entity.VendorStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateVendorStatusRequest {

    @NotNull
    private VendorStatus status;

    @Size(max = 1000)
    private String reason;
}
