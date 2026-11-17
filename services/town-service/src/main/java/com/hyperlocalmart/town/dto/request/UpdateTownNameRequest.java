package com.hyperlocalmart.town.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpdateTownNameRequest {

    @NotBlank
    @Size(max = 150)
    private String name;
}