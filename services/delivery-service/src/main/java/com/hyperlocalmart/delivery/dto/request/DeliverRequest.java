package com.hyperlocalmart.delivery.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class DeliverRequest {

    @NotBlank
    private String otp;

    private String deliveryPhotoMediaId;

    private String recipientName;

    /** Laundry cash: COLLECTED | NOT_COLLECTED (drop leg expects COLLECTED). */
    private String cashCollectionOutcome;
}
