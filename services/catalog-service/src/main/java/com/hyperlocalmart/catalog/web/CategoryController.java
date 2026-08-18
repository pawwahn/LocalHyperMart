package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.request.CreateCategoryRequest;
import com.hyperlocalmart.catalog.dto.request.SetCategoryPauseRequest;
import com.hyperlocalmart.catalog.dto.request.SetCategoryTownVisibilityRequest;
import com.hyperlocalmart.catalog.dto.response.BulkCategoryVisibilityResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryResponse;
import com.hyperlocalmart.catalog.dto.response.CategoryTownVisibilityResponse;
import com.hyperlocalmart.catalog.security.AuthUserPrincipal;
import com.hyperlocalmart.catalog.service.CategoryVisibilityService;
import com.hyperlocalmart.catalog.service.VendorListingService;
import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/catalog/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final VendorListingService vendorListingService;
    private final CategoryVisibilityService categoryVisibilityService;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<CategoryResponse>>>> listCategories(
            @RequestParam(required = false) UUID townId,
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        List<CategoryResponse> items;
        if (townId != null) {
            items = categoryVisibilityService.listVisibleInTown(townId);
        } else if (isSuperAdmin(principal)) {
            items = categoryVisibilityService.listForAdmin();
        } else {
            items = vendorListingService.listCategories();
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("items", items)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<CategoryResponse>> createCategory(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateCategoryRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        CategoryResponse created = vendorListingService.createCategory(request, principal.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, created));
    }

    @PatchMapping("/{categoryId}")
    public ResponseEntity<ApiResponse<CategoryResponse>> updateCategory(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID categoryId,
            @Valid @RequestBody CreateCategoryRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorListingService.updateCategory(categoryId, request, principal.getUserId())));
    }

    @PatchMapping("/visibility")
    public ResponseEntity<ApiResponse<BulkCategoryVisibilityResponse>> setAllPaused(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody SetCategoryPauseRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                categoryVisibilityService.setAllPaused(request.getPaused(), principal.getUserId())));
    }

    @PatchMapping("/{categoryId}/visibility")
    public ResponseEntity<ApiResponse<CategoryResponse>> setPaused(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID categoryId,
            @Valid @RequestBody SetCategoryPauseRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                categoryVisibilityService.setPaused(categoryId, request.getPaused(), principal.getUserId())));
    }

    @GetMapping("/{categoryId}/town-visibility")
    public ResponseEntity<ApiResponse<CategoryTownVisibilityResponse>> getTownVisibility(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID categoryId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, categoryVisibilityService.getTownVisibility(categoryId)));
    }

    @PutMapping("/{categoryId}/town-visibility")
    public ResponseEntity<ApiResponse<CategoryResponse>> setTownVisibility(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID categoryId,
            @Valid @RequestBody SetCategoryTownVisibilityRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                categoryVisibilityService.applyTownVisibility(categoryId, request, principal.getUserId())));
    }

    @DeleteMapping("/{categoryId}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> deleteCategory(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID categoryId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        vendorListingService.deleteCategory(categoryId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("deleted", true)));
    }

    private static boolean isSuperAdmin(AuthUserPrincipal principal) {
        return principal != null && principal.getRoles().contains("SUPER_ADMIN");
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (!isSuperAdmin(principal)) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
