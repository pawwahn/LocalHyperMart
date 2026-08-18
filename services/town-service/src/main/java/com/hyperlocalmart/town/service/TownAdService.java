package com.hyperlocalmart.town.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.town.dto.TownAdImageDto;
import com.hyperlocalmart.town.dto.request.UpsertTownAdRequest;
import com.hyperlocalmart.town.dto.request.UpsertTownAdsRequest;
import com.hyperlocalmart.town.dto.response.TownAdResponse;
import com.hyperlocalmart.town.dto.response.TownAdsResponse;
import com.hyperlocalmart.town.entity.TownAd;
import com.hyperlocalmart.town.entity.TownAdSlot;
import com.hyperlocalmart.town.repository.TownAdRepository;
import com.hyperlocalmart.town.repository.TownRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TownAdService {

    private static final int MAX_IMAGES = 3;
    private static final int MAX_TARGET_TOWNS = 200;
    public static final int MID_GRID_SLOTS = 5;
    private static final TypeReference<List<TownAdImageDto>> IMAGE_LIST =
            new TypeReference<>() {
            };

    private record AdKey(TownAdSlot slot, int slotIndex) {
    }

    private final TownAdRepository townAdRepository;
    private final TownRepository townRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public TownAdsResponse listPublicAds(UUID townId) {
        requireTown(townId);
        Map<AdKey, TownAd> merged = new LinkedHashMap<>();
        for (TownAd ad : townAdRepository.findByTownIdAndEnabledTrueOrderBySlotAscSlotIndexAsc(townId)) {
            if (isRenderable(ad)) {
                merged.put(new AdKey(ad.getSlot(), ad.getSlotIndex()), ad);
            }
        }
        for (TownAd ad : townAdRepository.findByAllTownsTrueAndEnabledTrueOrderByUpdatedAtDesc()) {
            if (!isRenderable(ad) || ad.getTownId().equals(townId)) {
                continue;
            }
            merged.putIfAbsent(new AdKey(ad.getSlot(), ad.getSlotIndex()), ad);
        }
        List<TownAdResponse> items = merged.values().stream().map(ad -> toResponse(ad, List.of(ad.getTownId()))).toList();
        return TownAdsResponse.builder().townId(townId).items(items).build();
    }

    @Transactional(readOnly = true)
    public TownAdsResponse listAdminAds(UUID townId) {
        requireTown(townId);
        List<TownAd> ads = townAdRepository.findByTownIdOrderBySlotAscSlotIndexAsc(townId);
        Map<UUID, List<UUID>> campaignTownIds = loadCampaignTownIds(ads);
        List<TownAdResponse> items = ads.stream()
                .map(ad -> toResponse(ad, resolveTargetTownIds(ad, campaignTownIds)))
                .toList();
        return TownAdsResponse.builder().townId(townId).items(items).build();
    }

    @Transactional
    public TownAdsResponse upsertAds(UUID townId, UpsertTownAdsRequest request, UUID actorId) {
        requireTown(townId);
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At least one ad is required");
        }
        Set<AdKey> seen = new HashSet<>();
        for (UpsertTownAdRequest item : request.getItems()) {
            if (item.getSlot() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Ad slot is required");
            }
            int slotIndex = normalizeSlotIndex(item.getSlot(), item.getSlotIndex());
            AdKey key = new AdKey(item.getSlot(), slotIndex);
            if (!seen.add(key)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Duplicate ad slot: " + item.getSlot() + " #" + slotIndex);
            }
            upsertAdAcrossTowns(townId, item, slotIndex, actorId);
        }
        return listAdminAds(townId);
    }

    private void upsertAdAcrossTowns(UUID editorTownId, UpsertTownAdRequest item, int slotIndex, UUID actorId) {
        TownAd editorAd = townAdRepository.findByTownIdAndSlotAndSlotIndex(editorTownId, item.getSlot(), slotIndex)
                .orElse(null);
        UUID previousCampaignId = editorAd != null ? editorAd.getCampaignId() : null;

        boolean allTowns = Boolean.TRUE.equals(item.getAllTowns());
        List<UUID> targetTownIds = resolveSaveTargetTownIds(editorTownId, item, allTowns);
        validateTargetTowns(targetTownIds);

        boolean enabled = Boolean.TRUE.equals(item.getEnabled());
        if (allTowns) {
            enabled = true;
        }

        TownAd template = TownAd.builder()
                .slot(item.getSlot())
                .slotIndex(slotIndex)
                .build();
        applyContent(template, item);
        if ((enabled || allTowns) && !isRenderable(template)) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "Cannot enable " + item.getSlot() + " #" + slotIndex
                            + " until shop name, headline, and at least one image are set");
        }

        UUID campaignId = null;
        if (!allTowns && targetTownIds.size() > 1) {
            campaignId = previousCampaignId != null ? previousCampaignId : UUID.randomUUID();
        }

        for (UUID targetTownId : targetTownIds) {
            TownAd ad = townAdRepository.findByTownIdAndSlotAndSlotIndex(targetTownId, item.getSlot(), slotIndex)
                    .orElseGet(() -> TownAd.builder()
                            .townId(targetTownId)
                            .slot(item.getSlot())
                            .slotIndex(slotIndex)
                            .build());
            copyContent(template, ad);
            ad.setEnabled(enabled);
            ad.setAllTowns(allTowns);
            ad.setCampaignId(campaignId);
            if (ad.getId() == null) {
                ad.setCreatedBy(actorId);
            }
            ad.setUpdatedBy(actorId);
            townAdRepository.save(ad);
        }

        cleanupCampaignMembers(previousCampaignId, item.getSlot(), slotIndex, targetTownIds, allTowns);
    }

    private void cleanupCampaignMembers(
            UUID previousCampaignId,
            TownAdSlot slot,
            int slotIndex,
            List<UUID> keepTownIds,
            boolean allTowns) {
        if (previousCampaignId == null) {
            return;
        }
        Set<UUID> keep = new HashSet<>(keepTownIds);
        for (TownAd sibling : townAdRepository.findByCampaignIdAndSlotAndSlotIndex(previousCampaignId, slot, slotIndex)) {
            if (allTowns || !keep.contains(sibling.getTownId())) {
                townAdRepository.delete(sibling);
            }
        }
    }

    private List<UUID> resolveSaveTargetTownIds(UUID editorTownId, UpsertTownAdRequest item, boolean allTowns) {
        if (allTowns) {
            return List.of(editorTownId);
        }
        LinkedHashSet<UUID> ids = new LinkedHashSet<>();
        ids.add(editorTownId);
        if (item.getTargetTownIds() != null) {
            for (UUID id : item.getTargetTownIds()) {
                if (id != null) {
                    ids.add(id);
                }
            }
        }
        return List.copyOf(ids);
    }

    private void validateTargetTowns(List<UUID> targetTownIds) {
        if (targetTownIds.size() > MAX_TARGET_TOWNS) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                    "An ad can target at most " + MAX_TARGET_TOWNS + " towns");
        }
        for (UUID id : targetTownIds) {
            requireTown(id);
        }
    }

    private Map<UUID, List<UUID>> loadCampaignTownIds(List<TownAd> ads) {
        Map<UUID, List<UUID>> out = new HashMap<>();
        for (TownAd ad : ads) {
            UUID campaignId = ad.getCampaignId();
            if (campaignId == null || out.containsKey(campaignId)) {
                continue;
            }
            List<UUID> townIds = townAdRepository
                    .findByCampaignIdAndSlotAndSlotIndex(campaignId, ad.getSlot(), ad.getSlotIndex())
                    .stream()
                    .map(TownAd::getTownId)
                    .distinct()
                    .toList();
            out.put(campaignId, townIds);
        }
        return out;
    }

    private List<UUID> resolveTargetTownIds(TownAd ad, Map<UUID, List<UUID>> campaignTownIds) {
        if (ad.getCampaignId() != null) {
            return campaignTownIds.getOrDefault(ad.getCampaignId(), List.of(ad.getTownId()));
        }
        return List.of(ad.getTownId());
    }

    private void applyContent(TownAd ad, UpsertTownAdRequest item) {
        ad.setShopName(trimTo(item.getShopName(), 120));
        ad.setHeadline(trimTo(item.getHeadline(), 160));
        ad.setBodyText(trimTo(item.getBodyText(), 240));
        ad.setCtaLabel(trimTo(item.getCtaLabel(), 60));
        applyImages(ad, item);
    }

    private void copyContent(TownAd from, TownAd to) {
        to.setShopName(from.getShopName());
        to.setHeadline(from.getHeadline());
        to.setBodyText(from.getBodyText());
        to.setCtaLabel(from.getCtaLabel());
        to.setImagesJson(from.getImagesJson());
        to.setImageUrl(from.getImageUrl());
        to.setImageMediaId(from.getImageMediaId());
    }

    private void applyImages(TownAd ad, UpsertTownAdRequest item) {
        List<TownAdImageDto> images = normalizeImages(item);
        if (images.size() > MAX_IMAGES) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Maximum " + MAX_IMAGES + " images per ad");
        }
        ad.setImagesJson(writeImages(images));
        if (images.isEmpty()) {
            ad.setImageUrl(null);
            ad.setImageMediaId(null);
            return;
        }
        TownAdImageDto first = images.get(0);
        ad.setImageUrl(first.getUrl());
        ad.setImageMediaId(parseUuid(first.getMediaId()));
    }

    private List<TownAdImageDto> normalizeImages(UpsertTownAdRequest item) {
        List<TownAdImageDto> out = new ArrayList<>();
        if (item.getImages() != null && !item.getImages().isEmpty()) {
            for (TownAdImageDto img : item.getImages()) {
                if (img == null || !StringUtils.hasText(img.getUrl())) {
                    continue;
                }
                out.add(TownAdImageDto.builder()
                        .url(img.getUrl().trim())
                        .mediaId(StringUtils.hasText(img.getMediaId()) ? img.getMediaId().trim() : null)
                        .build());
                if (out.size() >= MAX_IMAGES) {
                    break;
                }
            }
            return out;
        }
        if (StringUtils.hasText(item.getImageUrl())) {
            out.add(TownAdImageDto.builder()
                    .url(item.getImageUrl().trim())
                    .mediaId(item.getImageMediaId() != null ? item.getImageMediaId().toString() : null)
                    .build());
        }
        return out;
    }

    private void requireTown(UUID townId) {
        if (!townRepository.existsById(townId)) {
            throw new BusinessException(ErrorCode.NOT_FOUND, "Town not found");
        }
    }

    private boolean isRenderable(TownAd ad) {
        return StringUtils.hasText(ad.getShopName())
                && StringUtils.hasText(ad.getHeadline())
                && !readImages(ad).isEmpty();
    }

    private TownAdResponse toResponse(TownAd ad, List<UUID> targetTownIds) {
        List<TownAdImageDto> images = readImages(ad);
        String imageUrl = images.isEmpty() ? ad.getImageUrl() : images.get(0).getUrl();
        UUID mediaId = ad.getImageMediaId();
        if (!images.isEmpty() && StringUtils.hasText(images.get(0).getMediaId())) {
            mediaId = parseUuid(images.get(0).getMediaId());
        }
        return TownAdResponse.builder()
                .id(ad.getId())
                .townId(ad.getTownId())
                .slot(ad.getSlot())
                .slotKey(toSlotKey(ad.getSlot()))
                .slotIndex(ad.getSlotIndex())
                .shopName(ad.getShopName())
                .headline(ad.getHeadline())
                .bodyText(ad.getBodyText())
                .ctaLabel(ad.getCtaLabel())
                .images(images)
                .imageUrl(imageUrl)
                .imageMediaId(mediaId)
                .enabled(ad.isEnabled())
                .allTowns(ad.isAllTowns())
                .targetTownIds(targetTownIds)
                .build();
    }

    private List<TownAdImageDto> readImages(TownAd ad) {
        String raw = ad.getImagesJson();
        if (!StringUtils.hasText(raw) || "[]".equals(raw.trim())) {
            if (StringUtils.hasText(ad.getImageUrl())) {
                return List.of(TownAdImageDto.builder()
                        .url(ad.getImageUrl())
                        .mediaId(ad.getImageMediaId() != null ? ad.getImageMediaId().toString() : null)
                        .build());
            }
            return List.of();
        }
        try {
            List<TownAdImageDto> parsed = objectMapper.readValue(raw, IMAGE_LIST);
            if (parsed == null || parsed.isEmpty()) {
                return List.of();
            }
            return parsed.stream()
                    .filter(i -> i != null && StringUtils.hasText(i.getUrl()))
                    .limit(MAX_IMAGES)
                    .toList();
        } catch (Exception ex) {
            if (StringUtils.hasText(ad.getImageUrl())) {
                return List.of(TownAdImageDto.builder()
                        .url(ad.getImageUrl())
                        .mediaId(ad.getImageMediaId() != null ? ad.getImageMediaId().toString() : null)
                        .build());
            }
            return List.of();
        }
    }

    private String writeImages(List<TownAdImageDto> images) {
        try {
            return objectMapper.writeValueAsString(images == null ? List.of() : images);
        } catch (Exception ex) {
            throw new BusinessException(ErrorCode.INTERNAL_ERROR, "Failed to store ad images");
        }
    }

    private static UUID parseUuid(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static int normalizeSlotIndex(TownAdSlot slot, Integer slotIndex) {
        if (slot == TownAdSlot.HOME_MID_GRID) {
            int idx = slotIndex == null ? 1 : slotIndex;
            if (idx < 1 || idx > MID_GRID_SLOTS) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Mid-grid ad index must be between 1 and " + MID_GRID_SLOTS);
            }
            return idx;
        }
        return 0;
    }

    private static String toSlotKey(TownAdSlot slot) {
        return switch (slot) {
            case HOME_HERO -> "home_hero";
            case HOME_MID_GRID -> "home_mid_grid";
            case CART_UPSELL -> "cart_upsell";
        };
    }

    private static String trimTo(String value, int max) {
        if (!StringUtils.hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }
}
