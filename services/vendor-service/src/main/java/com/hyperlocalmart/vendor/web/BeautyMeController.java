package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpsertBeautyOpsRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertBeautyRatesRequest;
import com.hyperlocalmart.vendor.dto.response.BeautyArtistResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.BeautyVendorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/vendors/me/beauty")
@RequiredArgsConstructor
public class BeautyMeController {

    private final BeautyVendorService beautyVendorService;

    @GetMapping
    public ResponseEntity<ApiResponse<BeautyArtistResponse>> getMe(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyVendorService.getForUser(principal.getUserId())));
    }

    @PutMapping("/ops")
    public ResponseEntity<ApiResponse<BeautyArtistResponse>> upsertOps(
            @Valid @RequestBody UpsertBeautyOpsRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyVendorService.upsertOpsByVendor(principal.getUserId(), request)));
    }

    @PutMapping("/rates")
    public ResponseEntity<ApiResponse<BeautyArtistResponse>> upsertRates(
            @Valid @RequestBody UpsertBeautyRatesRequest request,
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyVendorService.upsertRatesByVendor(principal.getUserId(), request)));
    }

    private static void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}
