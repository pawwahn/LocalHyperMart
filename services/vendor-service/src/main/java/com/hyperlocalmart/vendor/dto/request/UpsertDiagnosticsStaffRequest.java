package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UpsertDiagnosticsStaffRequest {

    @NotBlank
    @Size(max = 15)
    private String phone;

    @NotBlank
    @Size(max = 120)
    private String displayName;

    /** LAB_ADMIN or LAB_STAFF */
    @NotBlank
    private String roleType;

    @Size(max = 30)
    private String title;

    private Boolean collectionCapable;

    /** Initial password for new vendor login (required on create). */
    @Size(min = 6, max = 72)
    private String password;

    private Boolean active;
}
