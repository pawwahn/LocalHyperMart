package com.hyperlocalmart.user.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AppAdminUserResponse {
    UUID userId;
    String phone;
    String firstName;
    String lastName;
    String status;
    /** SUPER_ADMIN, APP_ADMIN_WRITE, or APP_ADMIN_READ */
    String platformRole;
    boolean manageable;
    Instant lastLoginAt;
}
