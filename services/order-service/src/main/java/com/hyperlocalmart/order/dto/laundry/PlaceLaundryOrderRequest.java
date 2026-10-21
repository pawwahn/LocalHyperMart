package com.hyperlocalmart.order.dto.laundry;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Data
public class PlaceLaundryOrderRequest {

    @NotNull
    private UUID townId;

    @NotNull
    private UUID vendorId;

    @NotNull
    private UUID addressId;

    @NotNull
    private String logistics;

    @NotNull
    private String paymentMethod;

    /** RAZORPAY, CASHFREE, or PHONEPE. Used when paymentMethod is UPI. */
    private String paymentGateway;

    @Size(max = 400)
    private String specialInstructions;

    private Instant requestedPickupStart;

    private Instant requestedPickupEnd;

    /** Buyer must confirm the 1–3 day turnaround before the request is stored. */
    private boolean slaAcknowledged;

    @Valid
    @NotEmpty
    private List<LineInput> lines = new ArrayList<>();

    @Data
    public static class LineInput {
        @NotNull
        private String serviceType;

        @NotNull
        private String itemType;

        @NotNull
        private Integer quantity;

        @Size(max = 80)
        private String otherLabel;

        private UUID photoMediaId;
    }
}
