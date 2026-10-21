package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class SaveServiceOfferingRequest {

    @NotBlank
    @Size(max = 80)
    private String name;

    /** Laundry-style services hide the vendor Listings menu. */
    private Boolean hidesListings;
}
