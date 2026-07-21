package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class StaffUserResponse {

    private UUID userId;
    private String phone;
    private String role;
    private String status;
}
