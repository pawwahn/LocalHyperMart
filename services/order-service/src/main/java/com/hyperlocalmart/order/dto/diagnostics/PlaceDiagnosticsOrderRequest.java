package com.hyperlocalmart.order.dto.diagnostics;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class PlaceDiagnosticsOrderRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID vendorId;

    @NotNull
    private UUID patientProfileId;

    @NotNull
    private String referenceType;

    @Size(max = 120)
    private String referringDoctorName;

    @NotNull
    private UUID addressId;

    private List<UUID> testIds = new ArrayList<>();

    private List<UUID> packageIds = new ArrayList<>();

    @NotNull
    private String paymentMethod;

    private String paymentGateway;

    @Size(max = 20)
    private String contactPhone;

    @NotNull
    private Instant slotStart;

    @NotNull
    private Instant slotEnd;

    /** Branch slot template id chosen on checkout (for capacity and manual blocks). */
    private UUID slotTemplateId;
}
