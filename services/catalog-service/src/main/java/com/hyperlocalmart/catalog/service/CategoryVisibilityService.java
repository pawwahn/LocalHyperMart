package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.dto.request.SetCategoryTownVisibilityRequest;
import com.hyperlocalmart.catalog.dto.response.BulkCategoryVisibilityResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryTownVisibilityResponse;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.Category;
import com.hyperlocalmart.catalog.entity.CategoryTownOverride;
import com.hyperlocalmart.catalog.repository.CategoryRepository;
import com.hyperlocalmart.catalog.repository.CategoryTownOverrideRepository;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class CategoryVisibilityService {

    private final CategoryRepository categoryRepository;
    private final CategoryTownOverrideRepository overrideRepository;

    @Transactional(readOnly = true)
    public boolean isVisibleInTown(Category category, UUID townId) {
        return overrideRepository.findByCategoryIdAndTownId(category.getId(), townId)
                .map(CategoryTownOverride::isVisible)
                .orElse(category.getStatus() == CatalogItemStatus.ACTIVE);
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listVisibleInTown(UUID townId) {
        Map<UUID, Boolean> overrides = new HashMap<>();
        for (CategoryTownOverride row : overrideRepository.findByTownId(townId)) {
            overrides.put(row.getCategoryId(), row.isVisible());
        }
        return categoryRepository.findAllByOrderByNameAsc().stream()
                .filter(category -> overrides.getOrDefault(
                        category.getId(), category.getStatus() == CatalogItemStatus.ACTIVE))
                .map(category -> toCategory(category, 0, 0))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CategoryResponse> listForAdmin() {
        Map<UUID, long[]> counts = loadOverrideCounts();
        return categoryRepository.findAllByOrderByNameAsc().stream()
                .map(category -> {
                    long[] pair = counts.getOrDefault(category.getId(), new long[] {0, 0});
                    return toCategory(category, pair[0], pair[1]);
                })
                .toList();
    }

    @Transactional
    public CategoryResponse setPaused(UUID categoryId, boolean paused, UUID actorUserId) {
        Category category = requireCategory(categoryId);
        category.setStatus(paused ? CatalogItemStatus.INACTIVE : CatalogItemStatus.ACTIVE);
        category.setUpdatedBy(actorUserId);
        overrideRepository.deleteByCategoryId(categoryId);
        categoryRepository.save(category);
        return toCategory(category, 0, 0);
    }

    @Transactional
    public BulkCategoryVisibilityResponse setAllPaused(boolean paused, UUID actorUserId) {
        CatalogItemStatus status = paused ? CatalogItemStatus.INACTIVE : CatalogItemStatus.ACTIVE;
        int updated = categoryRepository.updateAllStatuses(status, actorUserId);
        overrideRepository.deleteAllOverrides();
        return BulkCategoryVisibilityResponse.builder()
                .paused(paused)
                .updatedCount(updated)
                .build();
    }

    @Transactional
    public CategoryResponse applyTownVisibility(
            UUID categoryId, SetCategoryTownVisibilityRequest request, UUID actorUserId) {
        Category category = requireCategory(categoryId);
        List<UUID> townIds = distinctTownIds(request.getTownIds());
        boolean show = Boolean.TRUE.equals(request.getVisible());
        boolean globallyLive = category.getStatus() == CatalogItemStatus.ACTIVE;

        if (globallyLive == show) {
            overrideRepository.deleteByCategoryIdAndTownIdIn(categoryId, townIds);
        } else {
            Map<UUID, CategoryTownOverride> existing = new HashMap<>();
            for (CategoryTownOverride row : overrideRepository.findByCategoryIdAndTownIdIn(categoryId, townIds)) {
                existing.put(row.getTownId(), row);
            }
            List<CategoryTownOverride> toSave = new ArrayList<>();
            for (UUID townId : townIds) {
                CategoryTownOverride row = existing.get(townId);
                if (row == null) {
                    row = CategoryTownOverride.builder()
                            .categoryId(categoryId)
                            .townId(townId)
                            .visible(show)
                            .build();
                } else {
                    row.setVisible(show);
                }
                toSave.add(row);
            }
            overrideRepository.saveAll(toSave);
        }
        category.setUpdatedBy(actorUserId);
        categoryRepository.save(category);
        long[] pair = countsFor(categoryId);
        return toCategory(category, pair[0], pair[1]);
    }

    @Transactional(readOnly = true)
    public CategoryTownVisibilityResponse getTownVisibility(UUID categoryId) {
        Category category = requireCategory(categoryId);
        List<UUID> hidden = new ArrayList<>();
        List<UUID> live = new ArrayList<>();
        for (CategoryTownOverride row : overrideRepository.findByCategoryId(categoryId)) {
            if (row.isVisible()) {
                live.add(row.getTownId());
            } else {
                hidden.add(row.getTownId());
            }
        }
        return CategoryTownVisibilityResponse.builder()
                .categoryId(categoryId)
                .paused(category.getStatus() != CatalogItemStatus.ACTIVE)
                .hiddenTownIds(hidden)
                .liveTownIds(live)
                .build();
    }

    private Category requireCategory(UUID categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Category not found"));
    }

    private static List<UUID> distinctTownIds(List<UUID> raw) {
        if (raw == null || raw.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Select at least one town");
        }
        return List.copyOf(new LinkedHashSet<>(raw));
    }

    private Map<UUID, long[]> loadOverrideCounts() {
        Map<UUID, long[]> counts = new HashMap<>();
        for (CategoryTownOverrideRepository.CountRow row : overrideRepository.countGroupedByCategoryAndVisible()) {
            long[] pair = counts.computeIfAbsent(row.getCategoryId(), ignored -> new long[] {0, 0});
            if (row.getVisible()) {
                pair[1] = row.getCnt();
            } else {
                pair[0] = row.getCnt();
            }
        }
        return counts;
    }

    private long[] countsFor(UUID categoryId) {
        long hidden = 0;
        long live = 0;
        for (CategoryTownOverride row : overrideRepository.findByCategoryId(categoryId)) {
            if (row.isVisible()) {
                live++;
            } else {
                hidden++;
            }
        }
        return new long[] {hidden, live};
    }

    static CategoryResponse toCategory(Category category, long hiddenTownCount, long liveTownCount) {
        return CategoryResponse.builder()
                .id(category.getId())
                .name(category.getName())
                .description(category.getDescription())
                .status(category.getStatus() == null ? CatalogItemStatus.ACTIVE.name() : category.getStatus().name())
                .hiddenTownCount(hiddenTownCount)
                .liveTownCount(liveTownCount)
                .build();
    }
}
