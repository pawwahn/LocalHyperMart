package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.client.AdminAuditClient;
import com.hyperlocalmart.catalog.dto.request.RecipeIngredientInput;
import com.hyperlocalmart.catalog.dto.request.UpsertRecipeRequest;
import com.hyperlocalmart.catalog.dto.response.AdminRecipeDetailResponse;
import com.hyperlocalmart.catalog.dto.response.AdminRecipeIngredientResponse;
import com.hyperlocalmart.catalog.dto.response.AdminRecipeSummaryResponse;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.MasterItem;
import com.hyperlocalmart.catalog.entity.Recipe;
import com.hyperlocalmart.catalog.entity.RecipeIngredient;
import com.hyperlocalmart.catalog.repository.MasterItemRepository;
import com.hyperlocalmart.catalog.repository.RecipeIngredientRepository;
import com.hyperlocalmart.catalog.repository.RecipeRepository;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RecipeAdminService {

    private final RecipeRepository recipeRepository;
    private final RecipeIngredientRepository recipeIngredientRepository;
    private final MasterItemRepository masterItemRepository;
    private final AdminAuditClient adminAuditClient;

    @Transactional(readOnly = true)
    public PageResponse<AdminRecipeSummaryResponse> list(String q, int page, int size) {
        String query = normalizeQuery(q);
        Page<Recipe> recipes = recipeRepository.adminSearch(
                query,
                PageRequest.of(page, size, Sort.by("name").ascending()));
        List<AdminRecipeSummaryResponse> items = recipes.getContent().stream()
                .map(r -> AdminRecipeSummaryResponse.builder()
                        .id(r.getId())
                        .name(r.getName())
                        .servings(r.getServings())
                        .enabled(r.isEnabled())
                        .ingredientCount(recipeIngredientRepository.countByRecipeId(r.getId()))
                        .updatedAt(r.getUpdatedAt())
                        .build())
                .toList();
        return PageResponse.<AdminRecipeSummaryResponse>builder()
                .items(items)
                .page(recipes.getNumber())
                .size(recipes.getSize())
                .totalElements(recipes.getTotalElements())
                .totalPages(recipes.getTotalPages())
                .build();
    }

    @Transactional(readOnly = true)
    public AdminRecipeDetailResponse get(UUID recipeId) {
        Recipe recipe = recipeRepository.findById(recipeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Recipe not found"));
        return toDetail(recipe);
    }

    @Transactional
    public AdminRecipeDetailResponse create(UpsertRecipeRequest request, UUID actorUserId) {
        Instant now = Instant.now();
        Recipe recipe = Recipe.builder()
                .id(UUID.randomUUID())
                .name(request.getName().trim())
                .searchText(resolveSearchText(request))
                .servings(request.getServings())
                .enabled(request.isEnabled())
                .createdAt(now)
                .updatedAt(now)
                .build();
        recipeRepository.save(recipe);
        saveIngredients(recipe.getId(), request.getIngredients());
        adminAuditClient.record("catalog", "CREATE_RECIPE", "Created recipe " + recipe.getName(), actorUserId, null, recipe.getId());
        return toDetail(recipe);
    }

    @Transactional
    public AdminRecipeDetailResponse update(UUID recipeId, UpsertRecipeRequest request, UUID actorUserId) {
        Recipe recipe = recipeRepository.findById(recipeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Recipe not found"));
        recipe.setName(request.getName().trim());
        recipe.setSearchText(resolveSearchText(request));
        recipe.setServings(request.getServings());
        recipe.setEnabled(request.isEnabled());
        recipe.setUpdatedAt(Instant.now());
        recipeRepository.save(recipe);
        recipeIngredientRepository.deleteByRecipeId(recipeId);
        saveIngredients(recipeId, request.getIngredients());
        adminAuditClient.record("catalog", "UPDATE_RECIPE", "Updated recipe " + recipe.getName(), actorUserId, null, recipeId);
        return toDetail(recipe);
    }

    @Transactional
    public void delete(UUID recipeId, UUID actorUserId) {
        Recipe recipe = recipeRepository.findById(recipeId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Recipe not found"));
        recipeIngredientRepository.deleteByRecipeId(recipeId);
        recipeRepository.delete(recipe);
        adminAuditClient.record("catalog", "DELETE_RECIPE", "Deleted recipe " + recipe.getName(), actorUserId, null, recipeId);
    }

    private void saveIngredients(UUID recipeId, List<RecipeIngredientInput> inputs) {
        Set<UUID> seenMaster = new HashSet<>();
        List<RecipeIngredient> rows = new ArrayList<>();
        short order = 0;
        for (RecipeIngredientInput input : inputs) {
            if (!seenMaster.add(input.getMasterItemId())) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Duplicate catalog item in ingredients");
            }
            MasterItem master = masterItemRepository.findById(input.getMasterItemId())
                    .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Catalog item not found"));
            if (master.getStatus() != CatalogItemStatus.ACTIVE) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Catalog item is not active: " + master.getName());
            }
            short sort = input.getSortOrder() != null ? input.getSortOrder() : order;
            rows.add(RecipeIngredient.builder()
                    .id(UUID.randomUUID())
                    .recipeId(recipeId)
                    .masterItem(master)
                    .quantityLabel(input.getQuantityLabel().trim())
                    .sortOrder(sort)
                    .build());
            order = (short) (sort + 1);
        }
        recipeIngredientRepository.saveAll(rows);
    }

    private AdminRecipeDetailResponse toDetail(Recipe recipe) {
        List<RecipeIngredient> ingredients = recipeIngredientRepository.findByRecipeIdOrderBySortOrder(recipe.getId());
        return AdminRecipeDetailResponse.builder()
                .id(recipe.getId())
                .name(recipe.getName())
                .searchText(recipe.getSearchText())
                .servings(recipe.getServings())
                .enabled(recipe.isEnabled())
                .ingredients(ingredients.stream().map(this::toIngredient).toList())
                .createdAt(recipe.getCreatedAt())
                .updatedAt(recipe.getUpdatedAt())
                .build();
    }

    private AdminRecipeIngredientResponse toIngredient(RecipeIngredient row) {
        return AdminRecipeIngredientResponse.builder()
                .id(row.getId())
                .masterItemId(row.getMasterItem().getId())
                .masterItemName(row.getMasterItem().getName())
                .quantityLabel(row.getQuantityLabel())
                .sortOrder(row.getSortOrder())
                .build();
    }

    private String resolveSearchText(UpsertRecipeRequest request) {
        if (StringUtils.hasText(request.getSearchText())) {
            return request.getSearchText().trim();
        }
        return request.getName().trim().toLowerCase();
    }

    private String normalizeQuery(String q) {
        if (!StringUtils.hasText(q)) {
            return null;
        }
        String trimmed = q.trim();
        return trimmed.length() > 80 ? trimmed.substring(0, 80) : trimmed;
    }
}
