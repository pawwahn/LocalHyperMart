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
    String govtIdType;
    /** Masked (last 4 only) in API responses. */
    String govtIdNumber;
    String reference1Name;
    String reference1Phone;
    String reference2Name;
    String reference2Phone;
    /** Present only on create when a temp password was generated or set for share-once. */
    String temporaryPassword;
}
