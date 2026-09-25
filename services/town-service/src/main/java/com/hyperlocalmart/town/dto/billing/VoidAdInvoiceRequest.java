package com.hyperlocalmart.town.dto.billing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class VoidAdInvoiceRequest {

    @NotBlank
    @Size(min = 3, max = 240)
    private String reason;
}
