package com.hyperlocalmart.user.dto.request;

import com.hyperlocalmart.user.entity.UserStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class UpdateUserStatusRequest {

    @NotNull
    private UserStatus status;
}
