package com.hyperlocalmart.payment.dto.request;

import jakarta.validation.constraints.NotEmpty;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class VendorPayoutLookupRequest {

    @NotEmpty
    private List<UUID> subOrderIds;
}
