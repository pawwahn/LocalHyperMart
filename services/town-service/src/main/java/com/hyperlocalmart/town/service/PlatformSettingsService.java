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
        return platformSettingRepository.findBySettingKey(KEY_PLATFORM)
                .map(row -> new LinkedHashMap<>(row.getSettingValue()))
                .orElseGet(this::defaults);
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
        return map;
    }
}
