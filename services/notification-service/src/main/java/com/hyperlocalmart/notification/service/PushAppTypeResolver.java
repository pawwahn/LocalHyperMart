package com.hyperlocalmart.notification.service;

public final class PushAppTypeResolver {

    private PushAppTypeResolver() {
    }

    public static String resolve(String eventCode) {
        if (eventCode != null && eventCode.startsWith("VENDOR_")) {
            return "VENDOR";
        }
        return "BUYER";
    }
}
