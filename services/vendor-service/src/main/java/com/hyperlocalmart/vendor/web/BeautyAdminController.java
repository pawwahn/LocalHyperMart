package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpsertBeautyProfileRequest;
import com.hyperlocalmart.vendor.dto.response.BeautyArtistResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.BeautyVendorService;
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
@RequestMapping("/api/v1/vendors/beauty")
@RequiredArgsConstructor
public class BeautyAdminController {

    private final BeautyVendorService beautyVendorService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<BeautyArtistResponse>>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyVendorService.listForTown(townId, false)));
    }

    @GetMapping("/{vendorId}")
    public ResponseEntity<ApiResponse<BeautyArtistResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyVendorService.get(vendorId)));
    }

    @PutMapping("/{vendorId}")
    public ResponseEntity<ApiResponse<BeautyArtistResponse>> upsert(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody UpsertBeautyProfileRequest request,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                beautyVendorService.upsertByAdmin(vendorId, principal.getUserId(), request)));
    }

    private static void requireAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
