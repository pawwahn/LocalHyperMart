package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class BindStaffContextRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID vendorId;
}
