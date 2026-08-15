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
import java.util.EnumSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TownAdService {

    private static final int MAX_IMAGES = 3;
    private static final TypeReference<List<TownAdImageDto>> IMAGE_LIST =
            new TypeReference<>() {
            };

    private final TownAdRepository townAdRepository;
    private final TownRepository townRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public TownAdsResponse listPublicAds(UUID townId) {
        requireTown(townId);
        List<TownAdResponse> items = townAdRepository.findByTownIdAndEnabledTrueOrderBySlotAsc(townId)
                .stream()
                .filter(this::isRenderable)
                .map(this::toResponse)
                .toList();
        return TownAdsResponse.builder().townId(townId).items(items).build();
    }

    @Transactional(readOnly = true)
    public TownAdsResponse listAdminAds(UUID townId) {
        requireTown(townId);
        List<TownAdResponse> items = townAdRepository.findByTownIdOrderBySlotAsc(townId)
                .stream()
                .map(this::toResponse)
                .toList();
        return TownAdsResponse.builder().townId(townId).items(items).build();
    }

    @Transactional
    public TownAdsResponse upsertAds(UUID townId, UpsertTownAdsRequest request, UUID actorId) {
        requireTown(townId);
        if (request.getItems() == null || request.getItems().isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "At least one ad is required");
        }
        Set<TownAdSlot> seen = EnumSet.noneOf(TownAdSlot.class);
        for (UpsertTownAdRequest item : request.getItems()) {
            if (item.getSlot() == null) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Ad slot is required");
            }
            if (!seen.add(item.getSlot())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Duplicate ad slot: " + item.getSlot());
            }
            TownAd ad = townAdRepository.findByTownIdAndSlot(townId, item.getSlot())
                    .orElseGet(() -> TownAd.builder().townId(townId).slot(item.getSlot()).build());
            ad.setShopName(trimTo(item.getShopName(), 120));
            ad.setHeadline(trimTo(item.getHeadline(), 160));
            ad.setBodyText(trimTo(item.getBodyText(), 240));
            ad.setCtaLabel(trimTo(item.getCtaLabel(), 60));
            applyImages(ad, item);
            boolean enabled = Boolean.TRUE.equals(item.getEnabled());
            if (enabled && !isRenderable(ad)) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        "Cannot enable " + item.getSlot()
                                + " until shop name, headline, and at least one image are set");
            }
            ad.setEnabled(enabled);
            if (ad.getId() == null) {
                ad.setCreatedBy(actorId);
            }
            ad.setUpdatedBy(actorId);
            townAdRepository.save(ad);
        }
        return listAdminAds(townId);
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

    private TownAdResponse toResponse(TownAd ad) {
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
                .shopName(ad.getShopName())
                .headline(ad.getHeadline())
                .bodyText(ad.getBodyText())
                .ctaLabel(ad.getCtaLabel())
                .images(images)
                .imageUrl(imageUrl)
                .imageMediaId(mediaId)
                .enabled(ad.isEnabled())
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
