package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.dto.response.CatalogHomeRailResponse;
import com.hyperlocalmart.catalog.dto.response.CatalogItemResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryResponse;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Same rail rules as the buyer shop home: match category names, rank fuller
 * categories first, drop a rail under 3 products, and do not repeat a product
 * that an earlier rail already took.
 */
public final class CatalogHomeRails {

    public record Spec(String id, String title, List<String> names, BigDecimal maxPrice) {
    }

    public static final List<Spec> SPECS = List.of(
            new Spec("fresh", "Fresh Store", List.of("dairy, bread and eggs", "dairy"), null),
            new Spec("farm", "Farm to Door", List.of("fresh vegetables", "vegetables", "fresh fruits", "fruits"), null),
            new Spec("pantry", "Regional pantry picks",
                    List.of("atta, rice and dal", "oils and ghee", "masalas", "cereals and breakfast"), null),
            new Spec("skin", "Best in skincare", List.of("skin care"), null),
            new Spec("health", "Health under ₹999", List.of("health and nutrition"), new BigDecimal("999")));

    private static final int RAIL_SIZE = 12;
    private static final int MIN_RAIL = 3;

    private CatalogHomeRails() {
    }

    public static List<UUID> categoryIds(List<CategoryResponse> categories) {
        Map<String, CategoryResponse> byName = byName(categories);
        Set<UUID> ids = new LinkedHashSet<>();
        for (Spec spec : SPECS) {
            for (String name : spec.names()) {
                CategoryResponse category = byName.get(name);
                if (category != null && category.getId() != null) {
                    ids.add(category.getId());
                }
            }
        }
        return List.copyOf(ids);
    }

    public static List<CatalogHomeRailResponse> build(
            List<CategoryResponse> categories, Map<UUID, List<CatalogItemResponse>> pagesByCategory) {
        Map<String, CategoryResponse> byName = byName(categories);
        Set<UUID> used = new LinkedHashSet<>();
        List<CatalogHomeRailResponse> rails = new ArrayList<>();
        for (Spec spec : SPECS) {
            List<Page> pages = new ArrayList<>();
            Set<UUID> seenInSpec = new LinkedHashSet<>();
            for (String name : spec.names()) {
                CategoryResponse category = byName.get(name);
                if (category == null || category.getId() == null || !seenInSpec.add(category.getId())) {
                    continue;
                }
                List<CatalogItemResponse> items = pagesByCategory.getOrDefault(category.getId(), List.of());
                pages.add(new Page(category.getId(), items));
            }
            if (pages.isEmpty()) {
                continue;
            }
            List<Page> ranked = pages.stream()
                    .sorted((left, right) -> Integer.compare(right.items.size(), left.items.size()))
                    .toList();
            List<CatalogItemResponse> chosen = new ArrayList<>();
            UUID categoryId = null;
            for (Page page : ranked) {
                for (CatalogItemResponse item : page.items) {
                    if (item.getListingId() == null || used.contains(item.getListingId())) {
                        continue;
                    }
                    if (overMax(item, spec.maxPrice())) {
                        continue;
                    }
                    chosen.add(item);
                    if (categoryId == null) {
                        categoryId = page.categoryId;
                    }
                    if (chosen.size() >= RAIL_SIZE) {
                        break;
                    }
                }
                if (chosen.size() >= RAIL_SIZE) {
                    break;
                }
            }
            if (chosen.size() < MIN_RAIL) {
                continue;
            }
            for (CatalogItemResponse item : chosen) {
                used.add(item.getListingId());
            }
            rails.add(CatalogHomeRailResponse.builder()
                    .id(spec.id())
                    .title(spec.title())
                    .categoryId(categoryId)
                    .items(List.copyOf(chosen))
                    .build());
        }
        return rails;
    }

    private static Map<String, CategoryResponse> byName(List<CategoryResponse> categories) {
        Map<String, CategoryResponse> byName = new LinkedHashMap<>();
        if (categories == null) {
            return byName;
        }
        for (CategoryResponse category : categories) {
            if (category.getName() == null) {
                continue;
            }
            byName.put(category.getName().toLowerCase(Locale.ROOT).trim(), category);
        }
        return byName;
    }

    /** Matches the buyer app: effective price, then discount, then list price. */
    private static boolean overMax(CatalogItemResponse item, BigDecimal max) {
        if (max == null) {
            return false;
        }
        BigDecimal price = item.getEffectivePrice();
        if (price == null) {
            price = item.getDiscountPrice();
        }
        if (price == null) {
            price = item.getPrice();
        }
        if (price == null) {
            price = BigDecimal.ZERO;
        }
        return price.compareTo(max) > 0;
    }

    private record Page(UUID categoryId, List<CatalogItemResponse> items) {
    }
}
