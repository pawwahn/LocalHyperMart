package com.hyperlocalmart.vendor.beauty;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

public final class BeautyServiceCatalog {

    private static final Map<String, Meta> STANDARD = standardCatalog();

    private static Map<String, Meta> standardCatalog() {
        Map<String, Meta> map = new LinkedHashMap<>();
        map.put("NATURAL_GLOW", new Meta("Natural glow", "Soft, fresh finish", "🌸"));
        map.put("PARTY_GLAM", new Meta("Party glam", "Bold eyes & contour", "💄"));
        map.put("HD_CAMERA", new Meta("HD / camera ready", "Long-wear base", "📸"));
        map.put("BRIDAL_FULL", new Meta("Bridal makeup", "Full ceremony look", "👰"));
        map.put("HAIR_STYLING", new Meta("Hair styling", "Blow-dry or updo", "💇"));
        map.put("SAREE_DRAPE", new Meta("Saree drape", "Pleats & pin help", "🥻"));
        map.put("MEHENDI", new Meta("Mehendi (hands)", "Classic bridal hands", "🌿"));
        map.put("MANICURE", new Meta("Manicure", "Hands & nails", "💅"));
        map.put("PEDICURE", new Meta("Pedicure", "Feet & nails", "🦶"));
        map.put("FACIAL", new Meta("Facial", "Cleanse & glow", "🧖"));
        map.put("THREADING", new Meta("Threading", "Brow & face", "✨"));
        map.put("WAXING", new Meta("Waxing", "Smooth skin", "🌟"));
        return Map.copyOf(map);
    }

    private BeautyServiceCatalog() {
    }

    public static String normalizeCode(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Service code is required");
        }
        String code = raw.trim().toUpperCase(Locale.ROOT);
        if (code.length() > 30) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Service code is too long");
        }
        if (code.startsWith("CUS_")) {
            if (!code.matches("CUS_[A-Z0-9_]{2,26}")) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid custom treatment code");
            }
            return code;
        }
        try {
            BeautyServiceType.valueOf(code);
            return code;
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Unknown beauty service: " + code);
        }
    }

    public static boolean isCustom(String code) {
        return code != null && code.startsWith("CUS_");
    }

    public static String slugFromLabel(String label) {
        String slug = label.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]+", "_");
        slug = slug.replaceAll("^_+|_+$", "");
        if (slug.isEmpty()) {
            slug = "TREATMENT";
        }
        if (slug.length() > 26) {
            slug = slug.substring(0, 26);
        }
        return "CUS_" + slug;
    }

    public static Optional<Meta> standardMeta(String code) {
        return Optional.ofNullable(STANDARD.get(code));
    }

    public record Meta(String label, String hint, String emoji) {
    }
}
