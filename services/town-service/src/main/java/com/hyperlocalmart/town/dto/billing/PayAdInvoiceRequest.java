package com.hyperlocalmart.town.dto.billing;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class PayAdInvoiceRequest {

    @NotBlank
    @Size(max = 20)
    private String method;

    @NotBlank
    @Size(min = 3, max = 80)
    private String reference;
}
