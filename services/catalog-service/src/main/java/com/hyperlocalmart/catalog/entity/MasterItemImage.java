package com.hyperlocalmart.catalog.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "master_item_images")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MasterItemImage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "master_item_id", nullable = false)
    private UUID masterItemId;

    @Column(name = "media_id", nullable = false)
    private UUID mediaId;

    @Column(name = "public_url", nullable = false, length = 500)
    private String publicUrl;

    @Column(name = "sort_order", nullable = false)
    private short sortOrder;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }
}
