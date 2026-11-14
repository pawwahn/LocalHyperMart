package com.hyperlocalmart.common.security;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

import java.util.Collection;

public final class PlatformAdminAuth {

    private PlatformAdminAuth() {
    }

    public static void requireStaff(Collection<String> roles) {
        if (!PlatformAdminRoles.isPlatformStaff(roles)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "App admin role required");
        }
    }

    public static void requireWrite(Collection<String> roles) {
        if (!PlatformAdminRoles.canWriteConfig(roles)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "App admin write access required");
        }
    }

    public static void requireSuperAdmin(Collection<String> roles) {
        if (!PlatformAdminRoles.isSuperAdmin(roles)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }

    public static void requireMoveMoney(Collection<String> roles) {
        if (!PlatformAdminRoles.canMoveMoney(roles)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }

    public static void requireIssueBills(Collection<String> roles) {
        if (!PlatformAdminRoles.canIssueBills(roles)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "App admin role required");
        }
    }
}
