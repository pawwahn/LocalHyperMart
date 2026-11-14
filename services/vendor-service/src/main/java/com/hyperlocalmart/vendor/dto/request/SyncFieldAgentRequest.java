package com.hyperlocalmart.vendor.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.UUID;

@Data
public class SyncFieldAgentRequest {

    @NotNull
    private UUID vendorId;

    @NotNull
    private UUID userId;

    @NotBlank
    @Size(max = 120)
    private String displayName;

    @NotBlank
    @Size(max = 15)
    private String phone;

    /** MANAGER, COLLECTION_AGENT, LAB_TECHNICIAN (blank → collection agent) */
    @Size(max = 30)
    private String labTitle;

    private Boolean collectionCapable;

    /** Delivery agent ACTIVE (false = paused on roster) */
    private boolean deliveryActive;
}
