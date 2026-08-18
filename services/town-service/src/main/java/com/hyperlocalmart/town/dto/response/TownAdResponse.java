package com.hyperlocalmart.town.dto.response;

import com.hyperlocalmart.town.dto.TownAdImageDto;
import com.hyperlocalmart.town.entity.TownAdSlot;
import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
@Builder
public class TownAdResponse {

    private UUID id;
    private UUID townId;
    private TownAdSlot slot;
    /** Buyer-facing slot id (home_hero / home_mid_grid). */
    private String slotKey;
    /** 1–5 for mid-grid carousel ordering. */
    private int slotIndex;
    private String shopName;
    private String headline;
    private String bodyText;
    private String ctaLabel;
    /** Up to 3 images for swipe carousel. */
    private List<TownAdImageDto> images;
    /** First image URL (convenience / backward compatible). */
    private String imageUrl;
    private UUID imageMediaId;
    private boolean enabled;
    private boolean allTowns;
    /** Towns that share this ad creative (includes townId when part of a multi-town campaign). */
    private List<UUID> targetTownIds;
}
