package com.hyperlocalmart.town.entity;

import com.hyperlocalmart.common.domain.BaseAuditEntity;
import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.UUID;

@Entity
@Table(
        name = "town_ads",
        uniqueConstraints = @UniqueConstraint(columnNames = {"town_id", "slot", "slot_index"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TownAd extends BaseAuditEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "town_id", nullable = false)
    private UUID townId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private TownAdSlot slot;

    /** 0 for hero/cart; 1–5 for mid-grid carousel slides. */
    @Column(name = "slot_index", nullable = false)
    @JdbcTypeCode(SqlTypes.SMALLINT)
    @Builder.Default
    private int slotIndex = 0;

    @Column(name = "shop_name", nullable = false, length = 120)
    @Builder.Default
    private String shopName = "";

    @Column(nullable = false, length = 160)
    @Builder.Default
    private String headline = "";

    @Column(name = "body_text", nullable = false, length = 240)
    @Builder.Default
    private String bodyText = "";

    @Column(name = "cta_label", nullable = false, length = 60)
    @Builder.Default
    private String ctaLabel = "";

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    @Column(name = "image_media_id")
    private UUID imageMediaId;

    /** JSON array of up to 3 {url, mediaId} objects. */
    @Column(name = "images_json", nullable = false, columnDefinition = "TEXT")
    @Builder.Default
    private String imagesJson = "[]";

    @Column(nullable = false)
    @Builder.Default
    private boolean enabled = false;

    /** When true, buyers in every town see this ad unless that town has its own live slot. */
    @Column(name = "all_towns", nullable = false)
    @Builder.Default
    private boolean allTowns = false;

    /** Links the same creative across multiple selected towns. */
    @Column(name = "campaign_id")
    private UUID campaignId;
}
