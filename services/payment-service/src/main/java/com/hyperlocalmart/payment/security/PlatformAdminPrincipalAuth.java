package com.hyperlocalmart.payment.security;

import com.hyperlocalmart.common.security.PlatformAdminAuth;
import com.hyperlocalmart.common.security.PlatformAdminRoles;

import java.util.Collections;
import java.util.List;

public final class PlatformAdminPrincipalAuth {

    private PlatformAdminPrincipalAuth() {
    }

    public static void requireStaff(AuthUserPrincipal principal) {
        PlatformAdminAuth.requireStaff(roles(principal));
    }

    public static void requireWrite(AuthUserPrincipal principal) {
        PlatformAdminAuth.requireWrite(roles(principal));
    }

    public static void requireSuperAdmin(AuthUserPrincipal principal) {
        PlatformAdminAuth.requireSuperAdmin(roles(principal));
    }

    public static void requireMoveMoney(AuthUserPrincipal principal) {
        PlatformAdminAuth.requireMoveMoney(roles(principal));
    }

    public static void requireIssueBills(AuthUserPrincipal principal) {
        PlatformAdminAuth.requireIssueBills(roles(principal));
    }

    public static boolean isPlatformStaff(AuthUserPrincipal principal) {
        return PlatformAdminRoles.isPlatformStaff(roles(principal));
    }

    public static boolean isSuperAdmin(AuthUserPrincipal principal) {
        return PlatformAdminRoles.isSuperAdmin(roles(principal));
    }

    private static List<String> roles(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null) {
            return Collections.emptyList();
        }
        return principal.getRoles();
    }
}
