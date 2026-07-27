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
        return pub;
    }

    @Transactional
    public Map<String, Object> patchSettings(Map<String, Object> patch) {
        Map<String, Object> current = getSettings();
        if (patch != null) {
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
        return map;
    }
}
