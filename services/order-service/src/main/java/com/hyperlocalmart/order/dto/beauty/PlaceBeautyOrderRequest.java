package com.hyperlocalmart.order.dto.beauty;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class PlaceBeautyOrderRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID vendorId;

    /** Primary service (legacy). Use {@link #serviceTypes} for multi-booking. */
    private String serviceType;

    private List<String> serviceTypes = new ArrayList<>();

    @Size(max = 30)
    private String occasion;

    @NotNull
    private String venue;

    @NotNull
    private String paymentMethod;

    /** FULL = pay entire booking now; PARTIAL = pay admin minimum prepay now (UPI only). */
    private String prepayMode;

    private String paymentGateway;

    /** Buyer mobile for UPI (studio bookings). Falls back to account phone when omitted. */
    @Size(max = 20)
    private String contactPhone;

    @Size(max = 400)
    private String specialInstructions;

    /** Required for AT_HOME. */
    private UUID addressId;

    @NotNull
    private Instant slotStart;

    @NotNull
    private Instant slotEnd;

    /** Optional inspiration / reference look (buyer upload). */
    private UUID referencePhotoMediaId;
}
