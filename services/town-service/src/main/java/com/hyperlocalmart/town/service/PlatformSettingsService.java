package com.hyperlocalmart.town.service;

import com.hyperlocalmart.town.entity.PlatformSetting;
import com.hyperlocalmart.town.repository.PlatformSettingRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformSettingsService {

    public static final String KEY_PLATFORM = "platform";

    private final PlatformSettingRepository platformSettingRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getSettings() {
        Map<String, Object> merged = defaults();
        platformSettingRepository.findBySettingKey(KEY_PLATFORM)
                .ifPresent(row -> merged.putAll(row.getSettingValue()));
        return merged;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getPublicSettings() {
        Map<String, Object> all = getSettings();
        Map<String, Object> pub = new LinkedHashMap<>();
        pub.put("termsUrl", all.getOrDefault("termsUrl", ""));
        pub.put("privacyUrl", all.getOrDefault("privacyUrl", ""));
        pub.put("refundUrl", all.getOrDefault("refundUrl", ""));
        pub.put("grievanceOfficer", all.getOrDefault("grievanceOfficer", ""));
        pub.put("supportPhone", all.getOrDefault("supportPhone", ""));
        pub.put("deliveryFee", all.getOrDefault("deliveryFee", 40));
        return pub;
    }

    @Transactional
    public Map<String, Object> patchSettings(Map<String, Object> patch) {
        Map<String, Object> current = getSettings();
        if (patch != null) {
            if (patch.containsKey("deliveryFee")) {
                current.put("deliveryFee", normalizeDeliveryFee(patch.get("deliveryFee")));
                patch = new LinkedHashMap<>(patch);
                patch.remove("deliveryFee");
            }
            current.putAll(patch);
        }
        PlatformSetting row = platformSettingRepository.findBySettingKey(KEY_PLATFORM)
                .orElseGet(() -> PlatformSetting.builder().settingKey(KEY_PLATFORM).build());
        row.setSettingValue(current);
        row.setUpdatedAt(Instant.now());
        if (row.getCreatedAt() == null) {
            row.setCreatedAt(Instant.now());
        }
        platformSettingRepository.save(row);
        return current;
    }

    private Map<String, Object> defaults() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("mapsEnabled", false);
        map.put("maintenanceMode", false);
        map.put("termsUrl", "");
        map.put("privacyUrl", "");
        map.put("refundUrl", "");
        map.put("grievanceOfficer", "");
        map.put("supportPhone", "9876500100");
        // Platform-wide buyer delivery fee (₹) — not town-specific.
        map.put("deliveryFee", 40);
        return map;
    }

    @Transactional(readOnly = true)
    public java.math.BigDecimal resolveDeliveryFee() {
        Object raw = getSettings().get("deliveryFee");
        if (raw instanceof Number n) {
            return java.math.BigDecimal.valueOf(n.doubleValue())
                    .setScale(2, java.math.RoundingMode.HALF_UP);
        }
        if (raw instanceof String s && !s.isBlank()) {
            return new java.math.BigDecimal(s.trim()).setScale(2, java.math.RoundingMode.HALF_UP);
        }
        return new java.math.BigDecimal("40.00");
    }

    private double normalizeDeliveryFee(Object raw) {
        double value;
        if (raw instanceof Number n) {
            value = n.doubleValue();
        } else if (raw instanceof String s && !s.isBlank()) {
            value = Double.parseDouble(s.trim());
        } else {
            value = 40;
        }
        if (value < 0 || Double.isNaN(value) || Double.isInfinite(value)) {
            throw new IllegalArgumentException("deliveryFee must be a non-negative number");
        }
        // Store as whole paise-friendly 2dp via rounding
        return Math.round(value * 100.0) / 100.0;
    }
}
