package com.hyperlocalmart.delivery.dto.response;

import lombok.Builder;
import lombok.Value;

import java.util.UUID;

@Value
@Builder
public class AdminHubResponse {
    UUID hubId;
    UUID townId;
    String name;
    String address;
    String phone;
    String status;
    UUID adminUserId;
    String adminPhone;
    /** Present only on create when a temp password was generated or set for share-once. */
    String temporaryPassword;
}
