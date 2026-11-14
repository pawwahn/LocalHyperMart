package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class UpsertDiagnosticsTestRequest {

    @Size(max = 40)
    private String code;

    @NotBlank
    @Size(max = 200)
    private String name;

    @NotNull
    private BigDecimal price;

    @Size(max = 400)
    private String fastingNote;

    private Boolean prescriptionRequired;
    private Boolean homeCollection;
    private Boolean active;
    private Integer sortOrder;
}
