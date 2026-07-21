package com.hyperlocalmart.town.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;

@Data
public class CreateTownRequest {

    @NotBlank
    private String name;

    @NotBlank
    private String state;

    @NotBlank
    private String townCode;

    @NotBlank
    private String stateCode;

    @NotEmpty
    private List<String> pincodes;

    @NotNull
    private BigDecimal coverageRadiusKm;
}
