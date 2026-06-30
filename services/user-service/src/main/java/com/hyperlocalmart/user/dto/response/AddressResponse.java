package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class AddressResponse {

    private UUID id;
    private UUID townId;
    private String label;
    private String recipientName;
    private String recipientPhone;
    private String line1;
    private String line2;
    private String landmark;
    private String pincode;
    private boolean isDefault;
}
