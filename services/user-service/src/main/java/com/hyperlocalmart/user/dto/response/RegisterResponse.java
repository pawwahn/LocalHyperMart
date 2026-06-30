package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.UUID;

@Data
@Builder
public class RegisterResponse {

    private UUID userId;
    private String role;
}
