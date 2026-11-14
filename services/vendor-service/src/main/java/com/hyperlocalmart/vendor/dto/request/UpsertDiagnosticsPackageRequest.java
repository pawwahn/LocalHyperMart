package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class UpsertDiagnosticsPackageRequest {

    @Size(max = 40)
    private String code;

    @NotBlank
    @Size(max = 200)
    private String name;

    @NotNull
    private BigDecimal price;

    /** Optional: what’s included / covered — shown on buyer package list. */
    @Size(max = 4000)
    private String description;

    private Boolean active;
    private Integer sortOrder;

    @NotNull
    private List<UUID> testIds = new ArrayList<>();
}
