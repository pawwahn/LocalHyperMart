package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.SetVendorCodPinRequest;
import com.hyperlocalmart.vendor.dto.response.VendorCodPinStatusResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.VendorCodPinService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/vendors/me/cod-pin")
@RequiredArgsConstructor
public class VendorCodPinController {

    private final VendorCodPinService vendorCodPinService;

    @GetMapping("/status")
    public ResponseEntity<ApiResponse<VendorCodPinStatusResponse>> status(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        boolean configured = vendorCodPinService.pinConfigured(principal.getUserId());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, VendorCodPinStatusResponse.builder()
                .configured(configured)
                .defaultPinActive(!configured)
                .build()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<Void>> setPin(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody SetVendorCodPinRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        vendorCodPinService.setPin(principal.getUserId(), request.getPin(), request.getOtp());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }

    private static void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}
