package com.hyperlocalmart.vendor.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class VendorCommercialTermsListResponse {
    private VendorCommercialTermsResponse current;
    private List<VendorCommercialTermsResponse> history;
}
