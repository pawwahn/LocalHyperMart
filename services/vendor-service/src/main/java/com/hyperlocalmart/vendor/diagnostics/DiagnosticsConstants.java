package com.hyperlocalmart.vendor.diagnostics;

import java.util.UUID;

public final class DiagnosticsConstants {

    public static final UUID SERVICE_ID = UUID.fromString("a4444444-4444-4444-8444-444444444444");
    public static final int MAX_ACTIVE_MANAGERS = 4;
    public static final String TITLE_MANAGER = "Manager";
    public static final String ROLE_LAB_ADMIN = "LAB_ADMIN";
    public static final String ROLE_LAB_STAFF = "LAB_STAFF";

    private DiagnosticsConstants() {
    }
}
