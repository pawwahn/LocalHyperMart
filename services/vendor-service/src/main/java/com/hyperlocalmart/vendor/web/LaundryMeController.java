package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpsertLaundryOpsRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertLaundryRatesRequest;
import com.hyperlocalmart.vendor.dto.response.LaundryShopResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.LaundryVendorService;
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
@RequestMapping("/api/v1/vendors/me/laundry")
@RequiredArgsConstructor
public class LaundryMeController {

    private final LaundryVendorService laundryVendorService;

    @GetMapping
    public ResponseEntity<ApiResponse<LaundryShopResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryVendorService.getForUser(principal.getUserId(), true)));
    }

    @PutMapping("/rates")
    public ResponseEntity<ApiResponse<LaundryShopResponse>> rates(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertLaundryRatesRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                laundryVendorService.upsertRatesByVendor(principal.getUserId(), request)));
    }

    @PutMapping("/ops")
    public ResponseEntity<ApiResponse<LaundryShopResponse>> ops(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertLaundryOpsRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                laundryVendorService.upsertOpsByVendor(principal.getUserId(), request)));
    }

    private static void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}
