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
public class CreateTownRequest {

    @NotBlank
    @Size(max = 150)
    private String name;

    /** ISO-like country code from geo catalog (e.g. IN). */
    @NotBlank
    @Size(min = 2, max = 2, message = "countryCode must be 2 characters")
    private String countryCode;

    /** State/region code from geo catalog (e.g. AP). */
    @NotBlank
    @Size(max = 10, message = "stateCode must be at most 10 characters")
    private String stateCode;

    @NotBlank
    @Size(max = 10, message = "townCode must be at most 10 characters")
    private String townCode;

    @NotEmpty(message = "Add at least one pincode")
    private List<@NotBlank @Size(max = 10) String> pincodes;

    @NotNull
    private BigDecimal coverageRadiusKm;

    /** Optional town-center point for "Use my location". Both must be set together. */
    @DecimalMin(value = "-90", message = "latitude must be between -90 and 90")
    @DecimalMax(value = "90", message = "latitude must be between -90 and 90")
    private BigDecimal latitude;

    @DecimalMin(value = "-180", message = "longitude must be between -180 and 180")
    @DecimalMax(value = "180", message = "longitude must be between -180 and 180")
    private BigDecimal longitude;
}
