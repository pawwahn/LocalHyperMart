package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpsertLaundryProfileRequest;
import com.hyperlocalmart.vendor.dto.response.LaundryShopResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.LaundryVendorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/laundry")
@RequiredArgsConstructor
public class LaundryAdminController {

    private final LaundryVendorService laundryVendorService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<LaundryShopResponse>>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryVendorService.listForTown(townId, false)));
    }

    @GetMapping("/{vendorId}")
    public ResponseEntity<ApiResponse<LaundryShopResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryVendorService.get(vendorId, true, true)));
    }

    @PutMapping("/{vendorId}")
    public ResponseEntity<ApiResponse<LaundryShopResponse>> upsert(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody UpsertLaundryProfileRequest request,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                laundryVendorService.upsertByAdmin(vendorId, principal.getUserId(), request)));
    }

    private static void requireAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
