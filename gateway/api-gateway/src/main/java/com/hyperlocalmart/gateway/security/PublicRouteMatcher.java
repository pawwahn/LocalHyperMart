package com.hyperlocalmart.gateway.security;

import org.springframework.http.HttpMethod;

public final class PublicRouteMatcher {

    private PublicRouteMatcher() {
    }

    public static boolean isPublic(HttpMethod method, String path) {
        if (path.startsWith("/actuator")) {
            return true;
        }
        if (path.startsWith("/api/v1/internal/")) {
            return false;
        }
        if (method == HttpMethod.POST && matches(path, "/api/v1/auth/register", "/api/v1/auth/login",
                "/api/v1/auth/refresh", "/api/v1/auth/forgot-password", "/api/v1/auth/reset-password",
                "/api/v1/auth/logout")) {
            return true;
        }
        if (method == HttpMethod.GET && (path.equals("/api/v1/towns") || path.equals("/api/v1/towns/"))) {
            return true;
        }
        if (method == HttpMethod.GET && path.equals("/api/v1/platform/settings/public")) {
            return true;
        }
        if (method == HttpMethod.GET && path.equals("/api/v1/geo/countries")) {
            return true;
        }
        if (method == HttpMethod.GET && path.equals("/api/v1/catalog/items")) {
            return true;
        }
        if (method == HttpMethod.GET && (path.equals("/api/v1/catalog/categories")
                || path.equals("/api/v1/catalog/master-items")
                || path.equals("/api/v1/catalog/units"))) {
            return true;
        }
        if (method == HttpMethod.POST && path.startsWith("/api/v1/payments/webhooks/")) {
            return true;
        }
        if (method == HttpMethod.GET && path.startsWith("/api/v1/media/") && path.endsWith("/content")) {
            return true;
        }
        return false;
    }

    public static boolean isInternalBlocked(String path) {
        return path.startsWith("/api/v1/internal/");
    }

    private static boolean matches(String path, String... prefixes) {
        for (String prefix : prefixes) {
            if (path.equals(prefix) || path.startsWith(prefix + "/")) {
                return true;
            }
        }
        return false;
    }
}
