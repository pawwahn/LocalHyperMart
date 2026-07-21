package com.hyperlocalmart.town.repository;

import com.hyperlocalmart.town.entity.PlatformSetting;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface PlatformSettingRepository extends JpaRepository<PlatformSetting, UUID> {

    Optional<PlatformSetting> findBySettingKey(String settingKey);
}
