package com.hyperlocalmart.user.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Data
@Builder
public class UserProfileResponse {

    private UUID id;
    private String phone;
    private String firstName;
    private String lastName;
    private String email;
    private List<String> roles;
    private UUID defaultTownId;
    private String status;
    private Instant lastLoginAt;
}
