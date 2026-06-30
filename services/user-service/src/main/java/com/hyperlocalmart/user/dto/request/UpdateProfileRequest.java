package com.hyperlocalmart.user.dto.request;

import lombok.Data;

import java.util.UUID;

@Data
public class UpdateProfileRequest {

    private String firstName;
    private String lastName;
    private String email;
    private UUID defaultTownId;
}
