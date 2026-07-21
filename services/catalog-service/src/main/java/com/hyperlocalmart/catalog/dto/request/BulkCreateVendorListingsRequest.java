package com.hyperlocalmart.catalog.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;

@Data
public class BulkCreateVendorListingsRequest {

    @NotEmpty
    @Valid
    private List<CreateVendorListingRequest> items;
}
