package com.hyperlocalmart.delivery.dto.request;

import lombok.Data;

@Data
public class PickedFromVendorRequest {

    private String note;

    /** Laundry cash: COLLECTED | NOT_COLLECTED */
    private String cashCollectionOutcome;
}
