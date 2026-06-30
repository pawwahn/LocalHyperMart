package com.hyperlocalmart.notification.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class NotificationLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id")
    private UUID townId;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "recipient_user_id")
    private UUID recipientUserId;

    @Column(name = "recipient_phone", length = 15)
    private String recipientPhone;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private NotificationChannel channel;

    @Column(name = "event_code", nullable = false, length = 80)
    private String eventCode;

    @Column(columnDefinition = "TEXT")
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private NotificationLogStatus status;

    @Column(name = "skip_reason", length = 100)
    private String skipReason;

    @Column(name = "provider_ref", length = 255)
    private String providerRef;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
