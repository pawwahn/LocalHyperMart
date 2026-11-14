package com.hyperlocalmart.delivery.client;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class SyncFieldAgentRequest {

    UUID vendorId;
    UUID userId;
    String displayName;
    String phone;
    String labTitle;
    boolean collectionCapable;
    boolean deliveryActive;
}
