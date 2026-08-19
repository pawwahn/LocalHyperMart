package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.dto.request.CartSuggestionsRequest;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.entity.MasterItem;
import com.hyperlocalmart.catalog.repository.MasterItemRepository;
import com.hyperlocalmart.common.api.PageResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CatalogSuggestionService {

    private final CatalogBrowseService catalogBrowseService;
    private final MasterItemRepository masterItemRepository;

    @Transactional(readOnly = true)
    public List<CatalogItemResponse> suggest(CartSuggestionsRequest request) {
        int limit = request.getLimit() == null ? 10 : Math.min(Math.max(request.getLimit(), 10), 20);
        Set<UUID> excluded = new HashSet<>(nullSafeIds(request.getExcludeListingIds()));
        Set<UUID> seenListingIds = new HashSet<>();
        List<CatalogItemResponse> picked = new ArrayList<>();

        Set<UUID> categoryIds = resolveCategoryIds(nullSafeIds(request.getSeedMasterItemIds()));
        for (UUID categoryId : categoryIds) {
            if (picked.size() >= limit) {
                break;
            }
            PageResponse<CatalogItemResponse> page = catalogBrowseService.browse(
                    request.getTownId(), categoryId, null, 0, limit, "rating", "desc");
            mergeBrowsePage(picked, seenListingIds, excluded, page.getItems(), limit);
        }

        if (picked.size() < limit) {
            for (String name : nullSafeNames(request.getSeedNames())) {
                if (picked.size() >= limit) {
                    break;
                }
                PageResponse<CatalogItemResponse> page = catalogBrowseService.browse(
                        request.getTownId(), null, name, 0, limit, "rating", "desc");
                mergeBrowsePage(picked, seenListingIds, excluded, page.getItems(), limit);
            }
        }

        fillWithTownFallbacks(picked, seenListingIds, excluded, request.getTownId(), limit);

        return picked;
    }

    private void fillWithTownFallbacks(
            List<CatalogItemResponse> picked,
            Set<UUID> seenListingIds,
            Set<UUID> excluded,
            UUID townId,
            int limit) {
        if (picked.size() >= limit) {
            return;
        }
        mergeBrowsePage(
                picked,
                seenListingIds,
                excluded,
                catalogBrowseService.topDiscountedInTown(townId, excluded, limit - picked.size()),
                limit);
        if (picked.size() >= limit) {
            return;
        }
        mergeBrowsePage(
                picked,
                seenListingIds,
                excluded,
                catalogBrowseService.recentlyUpdatedInTown(townId, excluded, limit - picked.size()),
                limit);
        if (picked.size() >= limit) {
            return;
        }
        mergeBrowsePage(
                picked,
                seenListingIds,
                excluded,
                catalogBrowseService.recentlyAddedInTown(townId, excluded, limit - picked.size()),
                limit);
    }

    private Set<UUID> resolveCategoryIds(List<UUID> masterItemIds) {
        if (masterItemIds.isEmpty()) {
            return Set.of();
        }
        LinkedHashSet<UUID> categoryIds = new LinkedHashSet<>();
        for (MasterItem masterItem : masterItemRepository.findAllById(masterItemIds)) {
            if (masterItem.getCategory() != null) {
                categoryIds.add(masterItem.getCategory().getId());
            }
        }
        return categoryIds;
    }

    private static void mergeBrowsePage(
            List<CatalogItemResponse> picked,
            Set<UUID> seenListingIds,
            Set<UUID> excluded,
            List<CatalogItemResponse> candidates,
            int limit) {
        if (candidates == null || candidates.isEmpty()) {
            return;
        }
        for (CatalogItemResponse item : candidates) {
            if (item.getListingId() == null) {
                continue;
            }
            if (excluded.contains(item.getListingId()) || !seenListingIds.add(item.getListingId())) {
                continue;
            }
            picked.add(item);
            if (picked.size() >= limit) {
                return;
            }
        }
    }

    private static List<UUID> nullSafeIds(List<UUID> ids) {
        return ids == null ? List.of() : ids.stream().filter(id -> id != null).distinct().toList();
    }

    private static List<String> nullSafeNames(List<String> names) {
        if (names == null) {
            return List.of();
        }
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String name : names) {
            if (name != null && !name.isBlank()) {
                out.add(name.trim());
            }
        }
        return List.copyOf(out);
    }
}
