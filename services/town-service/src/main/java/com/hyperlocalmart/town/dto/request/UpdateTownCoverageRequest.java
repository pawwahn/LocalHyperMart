package com.hyperlocalmart.town.dto.request;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class UpdateTownCoverageRequest {

    @NotNull
    @DecimalMin(value = "0.5", message = "coverage must be at least 0.5 km")
    @DecimalMax(value = "100", message = "coverage must be at most 100 km")
    private BigDecimal coverageRadiusKm;

    @NotEmpty(message = "Add at least one pincode")
    private List<@NotBlank @Size(max = 10) String> pincodes;

    @DecimalMin(value = "-90", message = "latitude must be between -90 and 90")
    @DecimalMax(value = "90", message = "latitude must be between -90 and 90")
    private BigDecimal latitude;

    @DecimalMin(value = "-180", message = "longitude must be between -180 and 180")
    @DecimalMax(value = "180", message = "longitude must be between -180 and 180")
    private BigDecimal longitude;
}
