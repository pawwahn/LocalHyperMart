package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.common.security.PlatformAdminAuth;
import com.hyperlocalmart.common.security.PlatformAdminRoles;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

public final class AdminAuth {

    private AdminAuth() {
    }

    public static UUID requireUserId(HttpServletRequest request) {
        String raw = request.getHeader("X-User-Id");
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Missing user context");
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Invalid user context");
        }
    }

    public static void requireSuperAdmin(HttpServletRequest request) {
        PlatformAdminAuth.requireSuperAdmin(roles(request));
    }

    public static void requirePlatformStaff(HttpServletRequest request) {
        PlatformAdminAuth.requireStaff(roles(request));
    }

    public static void requirePlatformWrite(HttpServletRequest request) {
        PlatformAdminAuth.requireWrite(roles(request));
    }

    public static void requireMoveMoney(HttpServletRequest request) {
        PlatformAdminAuth.requireMoveMoney(roles(request));
    }

    public static void requireIssueBills(HttpServletRequest request) {
        PlatformAdminAuth.requireIssueBills(roles(request));
    }

    public static boolean isSuperAdmin(HttpServletRequest request) {
        return PlatformAdminRoles.isSuperAdmin(roles(request));
    }

    public static boolean isPlatformStaff(HttpServletRequest request) {
        return PlatformAdminRoles.isPlatformStaff(roles(request));
    }

    public static boolean canWriteConfig(HttpServletRequest request) {
        return PlatformAdminRoles.canWriteConfig(roles(request));
    }

    public static boolean isHubAdmin(HttpServletRequest request) {
        return roles(request).contains("HUB_ADMIN");
    }

    public static Set<String> roles(HttpServletRequest request) {
        String header = request.getHeader("X-User-Roles");
        if (header == null || header.isBlank()) {
            return Set.of();
        }
        return Arrays.stream(header.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }
}
