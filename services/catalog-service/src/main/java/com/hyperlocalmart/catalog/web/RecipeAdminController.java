package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.request.UpsertRecipeRequest;
import com.hyperlocalmart.catalog.dto.response.AdminRecipeDetailResponse;
import com.hyperlocalmart.catalog.dto.response.AdminRecipeSummaryResponse;
import com.hyperlocalmart.catalog.security.AuthUserPrincipal;
import com.hyperlocalmart.catalog.service.RecipeAdminService;
import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/catalog/admin/recipes")
@RequiredArgsConstructor
@Validated
public class RecipeAdminController {

    private final RecipeAdminService recipeAdminService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<AdminRecipeSummaryResponse>>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "50") @Min(1) @Max(100) int size,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, recipeAdminService.list(q, page, size)));
    }

    @GetMapping("/{recipeId}")
    public ResponseEntity<ApiResponse<AdminRecipeDetailResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID recipeId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, recipeAdminService.get(recipeId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AdminRecipeDetailResponse>> create(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertRecipeRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        AdminRecipeDetailResponse created = recipeAdminService.create(request, principal.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, created));
    }

    @PutMapping("/{recipeId}")
    public ResponseEntity<ApiResponse<AdminRecipeDetailResponse>> update(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID recipeId,
            @Valid @RequestBody UpsertRecipeRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, recipeAdminService.update(recipeId, request, principal.getUserId())));
    }

    @DeleteMapping("/{recipeId}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> delete(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID recipeId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        recipeAdminService.delete(recipeId, principal.getUserId());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("deleted", true)));
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
