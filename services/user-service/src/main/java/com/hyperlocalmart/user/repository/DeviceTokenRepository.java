package com.hyperlocalmart.user.repository;

import com.hyperlocalmart.user.entity.DeviceToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeviceTokenRepository extends JpaRepository<DeviceToken, UUID> {

    Optional<DeviceToken> findByFcmToken(String fcmToken);

    List<DeviceToken> findByUserIdAndAppTypeOrderByLastUsedAtDesc(UUID userId, String appType);

    void deleteByUserId(UUID userId);

    void deleteByFcmToken(String fcmToken);
}
