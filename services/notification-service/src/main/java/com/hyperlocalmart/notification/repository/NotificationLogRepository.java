package com.hyperlocalmart.notification.repository;

import com.hyperlocalmart.notification.entity.NotificationLog;
import com.hyperlocalmart.notification.entity.NotificationLogStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, UUID> {

    List<NotificationLog> findByRecipientUserIdAndStatusOrderByCreatedAtDesc(
            UUID recipientUserId, NotificationLogStatus status, Pageable pageable);
}
