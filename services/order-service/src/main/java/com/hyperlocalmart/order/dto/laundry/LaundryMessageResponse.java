package com.hyperlocalmart.order.dto.laundry;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
public class LaundryMessageResponse {

    private UUID id;
    /** BUYER or VENDOR */
    private String senderRole;
    private String body;
    private Instant sentAt;
}
