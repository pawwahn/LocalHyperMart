package com.hyperlocalmart.user.dto.request;

import com.hyperlocalmart.user.entity.RoleName;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class PatchAppAdminRoleRequest {

    @NotNull
    private RoleName role;
}
