package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ApproveVendorRegistrationRequest {

    /** When blank, vendor gets the standard temporary password (HlM@ + last 4 digits of phone). */
    @Size(min = 8, max = 72)
    private String password;
}