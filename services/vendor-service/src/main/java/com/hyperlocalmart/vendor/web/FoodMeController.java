package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpsertFoodHotelPhotosRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertFoodProfileRequest;
import com.hyperlocalmart.vendor.dto.response.FoodProfileResponse;
import com.hyperlocalmart.vendor.entity.Vendor;
import com.hyperlocalmart.vendor.repository.VendorRepository;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.FoodVendorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/me/food")
@RequiredArgsConstructor
public class FoodMeController {

    private final FoodVendorService foodVendorService;
    private final VendorRepository vendorRepository;

    @GetMapping("/profile")
    public ResponseEntity<ApiResponse<FoodProfileResponse>> profile(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            HttpServletRequest httpRequest) {
        requireVendorUser(principal, vendorId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, foodVendorService.profileForVendor(vendorId)));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<FoodProfileResponse>> upsertProfile(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody UpsertFoodProfileRequest request,
            HttpServletRequest httpRequest) {
        requireVendorUser(principal, vendorId);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, foodVendorService.upsertProfile(vendorId, principal.getUserId(), request)));
    }

    @PutMapping("/hotel-photos")
    public ResponseEntity<ApiResponse<FoodProfileResponse>> upsertHotelPhotos(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody UpsertFoodHotelPhotosRequest request,
            HttpServletRequest httpRequest) {
        requireVendorUser(principal, vendorId);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, foodVendorService.upsertHotelPhotos(vendorId, principal.getUserId(), request)));
    }

    private void requireVendorUser(AuthUserPrincipal principal, UUID vendorId) {
        if (principal == null || principal.getUserId() == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Login required");
        }
        Vendor vendor = vendorRepository.findById(vendorId)
                .orElseThrow(() -> new BusinessException(ErrorCode.NOT_FOUND, "Vendor not found"));
        if (!vendor.getUserId().equals(principal.getUserId())) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Not your vendor account");
        }
    }
}