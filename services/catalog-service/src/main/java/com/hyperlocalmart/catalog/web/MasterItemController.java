package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.catalog.dto.request.CreateMasterItemRequest;
import com.hyperlocalmart.catalog.dto.request.SetMasterItemImagesRequest;
import com.hyperlocalmart.catalog.dto.response.MasterItemSummaryResponse;
import com.hyperlocalmart.catalog.security.AuthUserPrincipal;
import com.hyperlocalmart.catalog.service.VendorListingService;
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
@RequestMapping("/api/v1/catalog")
@RequiredArgsConstructor
@Validated
public class MasterItemController {

    private final VendorListingService vendorListingService;

    @GetMapping("/master-items")
    public ResponseEntity<ApiResponse<PageResponse<MasterItemSummaryResponse>>> listMasterItems(
            @RequestParam(required = false) UUID categoryId,
            @RequestParam(required = false) UUID unitId,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "25") @Min(1) @Max(200) int size,
            @RequestParam(defaultValue = "name") String sort,
            @RequestParam(defaultValue = "asc") String dir,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorListingService.listMasterItems(categoryId, unitId, q, page, size, sort, dir)));
    }

    @PostMapping("/master-items")
    public ResponseEntity<ApiResponse<MasterItemSummaryResponse>> createMasterItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateMasterItemRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        MasterItemSummaryResponse created = vendorListingService.createMasterItem(request, principal.getUserId());
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, created));
    }

    @PatchMapping("/master-items/{masterItemId}")
    public ResponseEntity<ApiResponse<MasterItemSummaryResponse>> updateMasterItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID masterItemId,
            @Valid @RequestBody CreateMasterItemRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorListingService.updateMasterItem(masterItemId, request, principal.getUserId())));
    }

    @DeleteMapping("/master-items/{masterItemId}")
    public ResponseEntity<ApiResponse<Map<String, Boolean>>> deleteMasterItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID masterItemId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        vendorListingService.deleteMasterItem(masterItemId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("deleted", true)));
    }

    @GetMapping("/master-items/{masterItemId}/images")
    public ResponseEntity<ApiResponse<Map<String, List<String>>>> listMasterItemImages(
            @PathVariable UUID masterItemId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                Map.of("items", vendorListingService.listMasterItemImageUrls(masterItemId))));
    }

    @PutMapping("/master-items/{masterItemId}/images")
    public ResponseEntity<ApiResponse<Map<String, List<String>>>> setMasterItemImages(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID masterItemId,
            @Valid @RequestBody SetMasterItemImagesRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        List<String> urls = vendorListingService.setMasterItemImages(masterItemId, request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("items", urls)));
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
