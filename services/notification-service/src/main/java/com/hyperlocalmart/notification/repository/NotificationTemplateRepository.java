package com.hyperlocalmart.notification.repository;

import com.hyperlocalmart.notification.entity.NotificationChannel;
import com.hyperlocalmart.notification.entity.NotificationTemplate;
import com.hyperlocalmart.notification.entity.TemplateStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface NotificationTemplateRepository extends JpaRepository<NotificationTemplate, UUID> {

    Optional<NotificationTemplate> findByEventCodeAndChannelAndLanguageAndStatus(
            String eventCode,
            NotificationChannel channel,
            String language,
            TemplateStatus status);
}
