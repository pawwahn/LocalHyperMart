package com.hyperlocalmart.common.security;

import java.util.Collection;
import java.util.Set;

/**
 * Roles for the platform (App) admin portal — super-admin web.
 * <ul>
 *   <li>{@link #SUPER_ADMIN} — full access including money movement</li>
 *   <li>{@link #APP_ADMIN_WRITE} — configure towns, hubs, vendors, catalog; no collect/pay</li>
 *   <li>{@link #APP_ADMIN_READ} — view data and issue bills; no mutations or money movement</li>
 * </ul>
 */
public final class PlatformAdminRoles {

    public static final String SUPER_ADMIN = "SUPER_ADMIN";
    public static final String APP_ADMIN_WRITE = "APP_ADMIN_WRITE";
    public static final String APP_ADMIN_READ = "APP_ADMIN_READ";

    private static final Set<String> STAFF = Set.of(SUPER_ADMIN, APP_ADMIN_WRITE, APP_ADMIN_READ);
    private static final Set<String> WRITE = Set.of(SUPER_ADMIN, APP_ADMIN_WRITE);

    private PlatformAdminRoles() {
    }

    public static boolean isSuperAdmin(Collection<String> roles) {
        return contains(roles, SUPER_ADMIN);
    }

    /** Any role that may use the App admin portal (read screens and reports). */
    public static boolean isPlatformStaff(Collection<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return false;
        }
        for (String role : roles) {
            if (role != null && STAFF.contains(role.trim())) {
                return true;
            }
        }
        return false;
    }

    /** Create/update towns, vendors, hubs, catalog, and related configuration. */
    public static boolean canWriteConfig(Collection<String> roles) {
        if (roles == null || roles.isEmpty()) {
            return false;
        }
        for (String role : roles) {
            if (role != null && WRITE.contains(role.trim())) {
                return true;
            }
        }
        return false;
    }

    /** Issue/send bills and invoices without confirming payment or moving money. */
    public static boolean canIssueBills(Collection<String> roles) {
        return isPlatformStaff(roles);
    }

    /** Collect, pay out, confirm bank receipts, cancel settlements — financial mutations. */
    public static boolean canMoveMoney(Collection<String> roles) {
        return isSuperAdmin(roles);
    }

    private static boolean contains(Collection<String> roles, String expected) {
        if (roles == null || roles.isEmpty()) {
            return false;
        }
        for (String role : roles) {
            if (expected.equals(role)) {
                return true;
            }
        }
        return false;
    }
}
