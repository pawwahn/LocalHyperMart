package com.hyperlocalmart.payment.service;

/**
 * Who is physically holding buyer cash for a vendor bag.
 * Online stays with the app; COD moves shop agent → shop, or hub agent → hub desk.
 */
public final class VendorCodCashHolderLabels {

    private VendorCodCashHolderLabels() {
    }

    public record View(String holderRole, String holderLabel, String holderDetail) {
    }

    public static View describe(
            String paymentMethod,
            boolean vendorAgentDelivery,
            String cashLocation,
            String agentName,
            String hubName) {
        if (paymentMethod == null || !"COD".equalsIgnoreCase(paymentMethod.trim())) {
            return new View("PLATFORM", "App", "UPI / online");
        }
        String loc = cashLocation == null || cashLocation.isBlank() ? "WITH_AGENT" : cashLocation.trim().toUpperCase();
        String agent = blankToNull(agentName);
        String hub = blankToNull(hubName);
        return switch (loc) {
            case "WITH_VENDOR" -> new View("VENDOR", "Shop", "Confirmed at shop");
            case "DECLARED_TO_VENDOR" -> new View("VENDOR", "Shop", "Declared — shop to confirm");
            case "AT_HUB" -> new View("HUB_ADMIN", "Hub desk", hub != null ? hub : "Close-day remitted");
            case "DECLARED_TO_HUB" -> new View("HUB_ADMIN", "Hub desk", "Declared — hub to confirm");
            default -> {
                if (vendorAgentDelivery) {
                    yield new View(
                            "VENDOR_AGENT",
                            "Shop agent",
                            agent != null ? agent : "Still with your rider");
                }
                yield new View(
                        "HUB_AGENT",
                        "Hub agent",
                        agent != null ? agent : "Still with hub rider");
            }
        };
    }

    private static String blankToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
