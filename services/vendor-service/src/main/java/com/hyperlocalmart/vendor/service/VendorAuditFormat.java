package com.hyperlocalmart.vendor.service;

import com.hyperlocalmart.vendor.entity.Shop;
import com.hyperlocalmart.vendor.entity.Vendor;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Field-level old → new lines for the vendors change-history tab. */
final class VendorAuditFormat {

    private static final List<String> KEY_ORDER = List.of(
            "status",
            "shopName",
            "businessName",
            "ownerName",
            "phone",
            "address",
            "gstNumber",
            "fssaiNumber",
            "bankAccount",
            "ifsc",
            "disabledReason",
            "rejectReason");

    private static final Map<String, String> LABELS = Map.ofEntries(
            Map.entry("status", "Status"),
            Map.entry("shopName", "Shop"),
            Map.entry("businessName", "Business"),
            Map.entry("ownerName", "Owner"),
            Map.entry("phone", "Phone"),
            Map.entry("address", "Address"),
            Map.entry("gstNumber", "GST"),
            Map.entry("fssaiNumber", "FSSAI"),
            Map.entry("bankAccount", "Bank account"),
            Map.entry("ifsc", "IFSC"),
            Map.entry("disabledReason", "Disable reason"),
            Map.entry("rejectReason", "Reject reason"));

    private VendorAuditFormat() {}

    static Map<String, Object> profile(Vendor vendor, Shop shop) {
        Map<String, Object> snap = new LinkedHashMap<>();
        snap.put("status", vendor.getStatus() == null ? null : vendor.getStatus().name());
        snap.put("shopName", shop == null ? null : shop.getShopName());
        snap.put("businessName", vendor.getBusinessName());
        snap.put("ownerName", vendor.getOwnerName());
        snap.put("phone", vendor.getPhone());
        snap.put("address", shop == null ? null : shop.getAddress());
        snap.put("gstNumber", vendor.getGstNumberEnc());
        snap.put("fssaiNumber", vendor.getFssaiNumber());
        snap.put("bankAccount", vendor.getBankAccountEnc());
        snap.put("ifsc", vendor.getIfscEnc());
        snap.put("disabledReason", vendor.getDisabledReason());
        return snap;
    }

    static List<String> changeLines(Map<String, Object> before, Map<String, Object> after) {
        Map<String, Object> left = before == null ? Map.of() : before;
        Map<String, Object> right = after == null ? Map.of() : after;
        List<String> lines = new ArrayList<>();
        for (String key : KEY_ORDER) {
            if (!left.containsKey(key) && !right.containsKey(key)) {
                continue;
            }
            Object a = left.get(key);
            Object b = right.get(key);
            if (same(a, b)) {
                continue;
            }
            String label = LABELS.getOrDefault(key, key);
            lines.add(label + ": " + pretty(key, a) + " → " + pretty(key, b));
        }
        return lines;
    }

    static String summary(String headline, List<String> lines) {
        String head = headline == null ? "" : headline.trim();
        if (lines == null || lines.isEmpty()) {
            return head.isEmpty() ? "Updated vendor" : head;
        }
        String joined = head.isEmpty() ? String.join("; ", lines) : head + "; " + String.join("; ", lines);
        return joined.length() <= 500 ? joined : joined.substring(0, 497) + "...";
    }

    private static boolean same(Object a, Object b) {
        String left = a == null ? "" : String.valueOf(a).trim();
        String right = b == null ? "" : String.valueOf(b).trim();
        return Objects.equals(left, right);
    }

    private static String pretty(String key, Object raw) {
        if (raw == null || String.valueOf(raw).isBlank()) {
            return "—";
        }
        String value = String.valueOf(raw).trim();
        if ("status".equals(key)) {
            return switch (value.toUpperCase()) {
                case "ACTIVE" -> "Active";
                case "DISABLED" -> "Disabled";
                case "PENDING" -> "Pending";
                case "APPROVED" -> "Approved";
                case "REJECTED" -> "Rejected";
                default -> value;
            };
        }
        return value.length() <= 80 ? value : value.substring(0, 77) + "...";
    }
}
