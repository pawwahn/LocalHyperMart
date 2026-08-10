package com.hyperlocalmart.user.dto.request;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.UUID;

@Data
public class BindStaffContextRequest {

    @NotNull
    private UUID townId;

    /** Set when binding a VENDOR role. */
    private UUID vendorId;

    /** Set when binding a HUB_ADMIN role. */
    private UUID hubId;
}
