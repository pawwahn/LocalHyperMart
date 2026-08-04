package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.CommercialTermsQuoteRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertVendorCommercialTermsRequest;
import com.hyperlocalmart.vendor.dto.response.CommercialTermsQuoteResponse;
import com.hyperlocalmart.vendor.dto.response.VendorCommercialTermsListResponse;
import com.hyperlocalmart.vendor.dto.response.VendorCommercialTermsResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.VendorCommercialTermsService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/{vendorId}/commercial-terms")
@RequiredArgsConstructor
public class VendorCommercialTermsController {

    private final VendorCommercialTermsService vendorCommercialTermsService;

    @GetMapping
    public ResponseEntity<ApiResponse<VendorCommercialTermsResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, vendorCommercialTermsService.get(vendorId)));
    }

    @GetMapping("/history")
    public ResponseEntity<ApiResponse<VendorCommercialTermsListResponse>> history(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, vendorCommercialTermsService.list(vendorId)));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<VendorCommercialTermsResponse>> upsert(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody UpsertVendorCommercialTermsRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest,
                vendorCommercialTermsService.upsert(vendorId, principal.getUserId(), request)));
    }

    @PostMapping("/quote")
    public ResponseEntity<ApiResponse<CommercialTermsQuoteResponse>> quote(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody CommercialTermsQuoteRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, vendorCommercialTermsService.quote(vendorId, request)));
    }

    private static void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
