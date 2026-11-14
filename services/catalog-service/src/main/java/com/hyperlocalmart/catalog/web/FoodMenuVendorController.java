package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.request.UpsertFoodMenuCategoryRequest;
import com.hyperlocalmart.catalog.dto.request.UpsertFoodMenuItemRequest;
import com.hyperlocalmart.catalog.dto.response.FoodMenuResponses;
import com.hyperlocalmart.catalog.security.AuthUserPrincipal;
import com.hyperlocalmart.catalog.service.FoodMenuService;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/catalog/vendors/me/food")
@RequiredArgsConstructor
public class FoodMenuVendorController {

    private final FoodMenuService foodMenuService;

    @GetMapping("/menu")
    public ResponseEntity<ApiResponse<FoodMenuResponses.VendorFoodMenuResponse>> menu(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, foodMenuService.vendorMenu(vendorId)));
    }

    @PostMapping("/categories")
    public ResponseEntity<ApiResponse<FoodMenuResponses.FoodMenuCategoryVm>> createCategory(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody UpsertFoodMenuCategoryRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, foodMenuService.createCategory(vendorId, principal.getUserId(), request)));
    }

    @PutMapping("/categories/{categoryId}")
    public ResponseEntity<ApiResponse<FoodMenuResponses.FoodMenuCategoryVm>> updateCategory(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID categoryId,
            @Valid @RequestBody UpsertFoodMenuCategoryRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, foodMenuService.updateCategory(vendorId, categoryId, principal.getUserId(), request)));
    }

    @DeleteMapping("/categories/{categoryId}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> deleteCategory(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID categoryId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        foodMenuService.deleteCategory(vendorId, categoryId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("deleted", true)));
    }

    @GetMapping("/items/{itemId}/photos")
    public ResponseEntity<ApiResponse<List<FoodMenuResponses.FoodMenuItemPhotoVm>>> itemPhotos(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID itemId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(
                ApiResponses.ok(httpRequest, foodMenuService.itemPhotos(vendorId, itemId)));
    }

    @PostMapping("/items")
    public ResponseEntity<ApiResponse<FoodMenuResponses.FoodMenuItemVm>> createItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody UpsertFoodMenuItemRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, foodMenuService.createItem(vendorId, principal.getUserId(), request)));
    }

    @PutMapping("/items/{itemId}")
    public ResponseEntity<ApiResponse<FoodMenuResponses.FoodMenuItemVm>> updateItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID itemId,
            @Valid @RequestBody UpsertFoodMenuItemRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, foodMenuService.updateItem(vendorId, itemId, principal.getUserId(), request)));
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> deleteItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID itemId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        foodMenuService.deleteItem(vendorId, itemId, principal.getUserId());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("deleted", true)));
    }

    private static void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || principal.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Login required");
        }
    }
}