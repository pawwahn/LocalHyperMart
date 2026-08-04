package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpdateVendorProfileRequest;
import com.hyperlocalmart.vendor.dto.request.UpdateVendorStatusRequest;
import com.hyperlocalmart.vendor.dto.response.VendorListResponse;
import com.hyperlocalmart.vendor.dto.response.VendorResponse;
import com.hyperlocalmart.vendor.entity.VendorStatus;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.VendorRegistrationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors")
@RequiredArgsConstructor
public class VendorAdminController {

    private final VendorRegistrationService vendorRegistrationService;

    @GetMapping
    public ResponseEntity<ApiResponse<VendorListResponse>> listVendors(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(required = false) String status,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        VendorStatus parsed = parseStatus(status);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, vendorRegistrationService.listVendors(townId, parsed)));
    }

    @PutMapping("/{vendorId}")
    public ResponseEntity<ApiResponse<VendorResponse>> updateProfile(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody UpdateVendorProfileRequest request,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest,
                vendorRegistrationService.updateVendorProfile(vendorId, principal.getUserId(), request)));
    }

    @PatchMapping("/{vendorId}/status")
    public ResponseEntity<ApiResponse<VendorResponse>> updateStatus(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody UpdateVendorStatusRequest request,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest,
                vendorRegistrationService.updateVendorStatus(vendorId, principal.getUserId(), request)));
    }

    private static VendorStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return VendorStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid vendor status");
        }
    }

    private static void requireAdmin(AuthUserPrincipal principal) {
        if (principal == null
                || (!principal.getRoles().contains("SUPER_ADMIN") && !principal.getRoles().contains("HUB_ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Admin role required");
        }
    }
}
