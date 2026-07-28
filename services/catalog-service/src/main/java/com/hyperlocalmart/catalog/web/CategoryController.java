package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.request.CreateCategoryRequest;
import com.hyperlocalmart.catalog.dto.response.CategoryResponse;
import com.hyperlocalmart.catalog.security.AuthUserPrincipal;
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
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/catalog/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final VendorListingService vendorListingService;

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, List<CategoryResponse>>>> listCategories(
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("items", vendorListingService.listCategories())));
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

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
