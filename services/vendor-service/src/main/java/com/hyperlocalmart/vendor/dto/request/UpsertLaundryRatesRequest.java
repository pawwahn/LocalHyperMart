package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class UpsertLaundryRatesRequest {

    @DecimalMin("0.0")
    private BigDecimal pickupCharge;

    @DecimalMin("0.0")
    private BigDecimal dropCharge;

    @DecimalMin("0.0")
    private BigDecimal pickupAndDropCharge;

    @Valid
    private List<UpsertLaundryProfileRequest.RateInput> rates = new ArrayList<>();
}
