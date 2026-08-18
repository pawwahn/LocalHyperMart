package com.hyperlocalmart.catalog.service;

import com.hyperlocalmart.catalog.dto.request.SetCategoryTownVisibilityRequest;
import com.hyperlocalmart.catalog.dto.response.BulkCategoryVisibilityResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryResponse;
import com.hyperlocalmart.catalog.entity.CatalogItemStatus;
import com.hyperlocalmart.catalog.entity.Category;
import com.hyperlocalmart.catalog.entity.CategoryTownOverride;
import com.hyperlocalmart.catalog.repository.CategoryRepository;
import com.hyperlocalmart.catalog.repository.CategoryTownOverrideRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CategoryVisibilityServiceTest {

    @Mock private CategoryRepository categoryRepository;
    @Mock private CategoryTownOverrideRepository overrideRepository;
    @InjectMocks private CategoryVisibilityService service;

    @Test
    void setAllPaused_hidesEverywhereAndClearsAllOverrides() {
        UUID actor = UUID.randomUUID();
        when(categoryRepository.updateAllStatuses(CatalogItemStatus.INACTIVE, actor)).thenReturn(45);

        BulkCategoryVisibilityResponse result = service.setAllPaused(true, actor);

        assertThat(result.isPaused()).isTrue();
        assertThat(result.getUpdatedCount()).isEqualTo(45);
        verify(overrideRepository).deleteAllOverrides();
    }

    @Test
    void setPaused_hidesEverywhereAndClearsOverrides() {
        UUID id = UUID.randomUUID();
        Category category = Category.builder().id(id).name("Chocolates").status(CatalogItemStatus.ACTIVE).build();
        when(categoryRepository.findById(id)).thenReturn(Optional.of(category));
        when(categoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CategoryResponse result = service.setPaused(id, true, UUID.randomUUID());

        assertThat(result.getStatus()).isEqualTo("INACTIVE");
        verify(overrideRepository).deleteByCategoryId(id);
    }

    @Test
    void hideInTowns_storesOnlyExceptions() {
        UUID id = UUID.randomUUID();
        UUID townA = UUID.randomUUID();
        UUID townB = UUID.randomUUID();
        Category category = Category.builder().id(id).name("Chocolates").status(CatalogItemStatus.ACTIVE).build();
        when(categoryRepository.findById(id)).thenReturn(Optional.of(category));
        when(categoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(overrideRepository.findByCategoryIdAndTownIdIn(eq(id), any())).thenReturn(List.of());
        when(overrideRepository.findByCategoryId(id)).thenReturn(List.of());

        SetCategoryTownVisibilityRequest request = new SetCategoryTownVisibilityRequest();
        request.setVisible(false);
        request.setTownIds(List.of(townA, townB, townA));
        service.applyTownVisibility(id, request, UUID.randomUUID());

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CategoryTownOverride>> captor = ArgumentCaptor.forClass(List.class);
        verify(overrideRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(2);
        assertThat(captor.getValue()).allMatch(row -> !row.isVisible());
    }

    @Test
    void showInTownsWhileLive_removesHideOverrides() {
        UUID id = UUID.randomUUID();
        UUID townA = UUID.randomUUID();
        Category category = Category.builder().id(id).name("Chocolates").status(CatalogItemStatus.ACTIVE).build();
        when(categoryRepository.findById(id)).thenReturn(Optional.of(category));
        when(categoryRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(overrideRepository.findByCategoryId(id)).thenReturn(List.of());

        SetCategoryTownVisibilityRequest request = new SetCategoryTownVisibilityRequest();
        request.setVisible(true);
        request.setTownIds(List.of(townA));
        service.applyTownVisibility(id, request, UUID.randomUUID());

        verify(overrideRepository).deleteByCategoryIdAndTownIdIn(eq(id), eq(List.of(townA)));
    }
}
