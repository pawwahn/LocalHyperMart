package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AcceptLegalRequest {

    @NotNull
    @Min(1)
    private Integer legalVersion;
}
