package com.hyperlocalmart.town.dto.request;

import com.hyperlocalmart.town.dto.TownAdImageDto;
import com.hyperlocalmart.town.entity.TownAdSlot;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;
import java.util.UUID;

@Data
public class UpsertTownAdRequest {

    @NotNull
    private TownAdSlot slot;

    /** 0 for hero/cart; 1–5 for HOME_MID_GRID carousel slides. */
    private Integer slotIndex;

    @Size(max = 120)
    private String shopName;

    @Size(max = 160)
    private String headline;

    @Size(max = 240)
    private String bodyText;

    @Size(max = 60)
    private String ctaLabel;

    /** Preferred: up to 3 images. */
    @Valid
    @Size(max = 3)
    private List<TownAdImageDto> images;

    /** Legacy single-image fields (used if images is null/empty). */
    private String imageUrl;

    private UUID imageMediaId;

    private Boolean enabled;

    /** When true, this live ad is shown in every town that has no local ad in this slot. */
    private Boolean allTowns;

    /** When set (and allTowns is false), replicate this ad to these towns. Current town is always included. */
    private List<UUID> targetTownIds;
}
