package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.common.security.PlatformAdminRoles;
import com.hyperlocalmart.vendor.dto.request.ApproveVendorRegistrationRequest;
import com.hyperlocalmart.vendor.dto.request.CreateRegistrationRequest;
import com.hyperlocalmart.vendor.dto.request.RejectRegistrationRequest;
import com.hyperlocalmart.vendor.dto.response.VendorRegistrationListResponse;
import com.hyperlocalmart.vendor.dto.response.VendorRegistrationResponse;
import com.hyperlocalmart.vendor.entity.RegistrationRequestStatus;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.security.PlatformAdminPrincipalAuth;
import com.hyperlocalmart.vendor.service.VendorRegistrationService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/registration-requests")
@RequiredArgsConstructor
public class VendorRegistrationController {

    private final VendorRegistrationService vendorRegistrationService;

    @PostMapping
    public ResponseEntity<ApiResponse<VendorRegistrationResponse>> create(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateRegistrationRequest request,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, vendorRegistrationService.create(request, principal.getUserId())));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<VendorRegistrationListResponse>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) String status,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        RegistrationRequestStatus parsed = parseStatus(status);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, vendorRegistrationService.list(parsed)));
    }

    @PostMapping("/{id}/approve")
    public ResponseEntity<ApiResponse<VendorRegistrationResponse>> approve(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id,
            @RequestBody(required = false) @Valid ApproveVendorRegistrationRequest request,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireWrite(principal);
        String password = request == null ? null : request.getPassword();
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, vendorRegistrationService.approve(id, principal.getUserId(), password)));
    }

    @PostMapping("/{id}/reject")
    public ResponseEntity<ApiResponse<VendorRegistrationResponse>> reject(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody RejectRegistrationRequest request,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireWrite(principal);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest,
                vendorRegistrationService.reject(id, principal.getUserId(), request.getReason())));
    }

    private static RegistrationRequestStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        try {
            return RegistrationRequestStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Invalid registration status");
        }
    }

    private static void requireAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Admin role required");
        }
        if (principal.getRoles().contains("HUB_ADMIN")
                || PlatformAdminRoles.isPlatformStaff(principal.getRoles())) {
            return;
        }
        throw new BusinessException(ErrorCode.FORBIDDEN, "Admin role required");
    }
}
