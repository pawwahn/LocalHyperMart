package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
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
        Set<String> roles = roles(request);
        if (!roles.contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }

    public static boolean isSuperAdmin(HttpServletRequest request) {
        return roles(request).contains("SUPER_ADMIN");
    }

    private static Set<String> roles(HttpServletRequest request) {
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
