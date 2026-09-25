package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.VendorShopClient;
import com.hyperlocalmart.catalog.dto.response.RecipeSearchResponse;
import com.hyperlocalmart.catalog.dto.response.RecipeShopLineResponse;
import com.hyperlocalmart.catalog.dto.response.RecipeShopPlanResponse;
import com.hyperlocalmart.catalog.dto.response.RecipeSummaryResponse;
import com.hyperlocalmart.catalog.entity.Recipe;
import com.hyperlocalmart.catalog.entity.RecipeIngredient;
import com.hyperlocalmart.catalog.entity.VendorListing;
import com.hyperlocalmart.catalog.repository.MasterItemImageRepository;
import com.hyperlocalmart.catalog.repository.RecipeIngredientRepository;
import com.hyperlocalmart.catalog.repository.RecipeRepository;
import com.hyperlocalmart.catalog.repository.VendorListingRepository;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecipeService {

    private static final int SEARCH_LIMIT = 12;

    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final VendorListingRepository vendorListingRepository;
    private final MasterItemImageRepository masterItemImageRepository;
    private final VendorShopClient vendorShopClient;

    @Transactional(readOnly = true)
    public RecipeSearchResponse search(String query) {
        String q = normalizeQuery(query);
        List<Recipe> recipes = recipeRepository.searchEnabled(q);
        if (recipes.size() > SEARCH_LIMIT) {
            recipes = recipes.subList(0, SEARCH_LIMIT);
        }
        List<RecipeSummaryResponse> items = recipes.stream().map(this::toSummary).toList();
        return RecipeSearchResponse.builder().items(items).build();
    }

    @Transactional(readOnly = true)
    public RecipeShopPlanResponse planForTown(UUID recipeId, UUID townId) {
        Recipe recipe = recipeRepository.findByIdAndEnabledTrue(recipeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Recipe not found"));
        List<RecipeIngredient> ingredients = recipeIngredientRepository.findByRecipeIdOrderBySortOrder(recipeId);
        if (ingredients.isEmpty()) {
            return RecipeShopPlanResponse.builder()
                    .id(recipe.getId())
                    .name(recipe.getName())
                    .servings(recipe.getServings())
                    .ingredients(List.of())
                    .build();
        }

        List<UUID> masterIds = ingredients.stream()
                .map(ri -> ri.getMasterItem().getId())
                .distinct()
                .toList();
        List<VendorListing> listings = vendorListingRepository.findActiveByTownAndMasterItemIdIn(townId, masterIds);
        Map<UUID, VendorListing> bestByMaster = pickCheapestListingPerMaster(listings);

        List<UUID> shopIds = bestByMaster.values().stream().map(VendorListing::getShopId).distinct().toList();
        Map<UUID, VendorShopClient.ShopInfo> shops = vendorShopClient.getShopsByIds(shopIds);

        Map<UUID, String> imageByMaster = primaryImageByMaster(masterIds);

        List<RecipeShopLineResponse> lines = new ArrayList<>();
        for (RecipeIngredient ri : ingredients) {
            UUID masterId = ri.getMasterItem().getId();
            VendorListing listing = bestByMaster.get(masterId);
            if (listing == null) {
                lines.add(RecipeShopLineResponse.builder()
                        .masterItemId(masterId)
                        .masterItemName(ri.getMasterItem().getName())
                        .quantityLabel(ri.getQuantityLabel())
                        .available(false)
                        .build());
                continue;
            }
            VendorShopClient.ShopInfo shop = shops.get(listing.getShopId());
            BigDecimal effective = ListingPricing.resolveEffectivePrice(listing);
            lines.add(RecipeShopLineResponse.builder()
                    .masterItemId(masterId)
                    .masterItemName(ri.getMasterItem().getName())
                    .quantityLabel(ri.getQuantityLabel())
                    .listingId(listing.getId())
                    .shopName(shop == null || !StringUtils.hasText(shop.shopName()) ? "Local shop" : shop.shopName())
                    .effectivePrice(effective)
                    .imageUrl(imageByMaster.get(masterId))
                    .available(true)
                    .build());
        }

        return RecipeShopPlanResponse.builder()
                .id(recipe.getId())
                .name(recipe.getName())
                .servings(recipe.getServings())
                .ingredients(lines)
                .build();
    }

    private Map<UUID, VendorListing> pickCheapestListingPerMaster(List<VendorListing> listings) {
        Map<UUID, VendorListing> out = new HashMap<>();
        for (VendorListing listing : listings) {
            UUID masterId = listing.getMasterItem().getId();
            VendorListing existing = out.get(masterId);
            if (existing == null) {
                out.put(masterId, listing);
                continue;
            }
            BigDecimal a = ListingPricing.resolveEffectivePrice(existing);
            BigDecimal b = ListingPricing.resolveEffectivePrice(listing);
            if (b.compareTo(a) < 0) {
                out.put(masterId, listing);
            }
        }
        return out;
    }

    private Map<UUID, String> primaryImageByMaster(List<UUID> masterIds) {
        Map<UUID, String> out = new HashMap<>();
        if (masterIds.isEmpty()) {
            return out;
        }
        masterItemImageRepository.findByMasterItemIdInOrderByMasterItemIdAscSortOrderAsc(masterIds).stream()
                .sorted(Comparator.comparingInt(img -> img.getSortOrder()))
                .forEach(img -> out.putIfAbsent(img.getMasterItemId(), img.getPublicUrl()));
        return out;
    }

    private RecipeSummaryResponse toSummary(Recipe recipe) {
        return RecipeSummaryResponse.builder()
                .id(recipe.getId())
                .name(recipe.getName())
                .servings(recipe.getServings())
                .build();
    }

    private String normalizeQuery(String query) {
        if (!StringUtils.hasText(query)) {
            return null;
        }
        String trimmed = query.trim();
        return trimmed.length() > 80 ? trimmed.substring(0, 80) : trimmed;
    }
}
