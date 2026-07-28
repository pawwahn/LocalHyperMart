package com.hyperlocalmart.catalog.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.catalog.dto.request.BulkCreateVendorListingsRequest;
import com.hyperlocalmart.catalog.dto.request.CreateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.request.SetVendorListingImagesRequest;
import com.hyperlocalmart.catalog.dto.request.UpdateVendorListingRequest;
import com.hyperlocalmart.catalog.dto.response.VendorListingResponse;
import com.hyperlocalmart.catalog.security.AuthUserPrincipal;
import com.hyperlocalmart.catalog.service.VendorListingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/catalog/vendors/me/listings")
@RequiredArgsConstructor
public class VendorListingController {

    private final VendorListingService vendorListingService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<VendorListingResponse>>> listMyListings(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorListingService.listMyListings(vendorId, page, size)));
    }

    @GetMapping("/{listingId}")
    public ResponseEntity<ApiResponse<VendorListingResponse>> getListing(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID listingId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorListingService.getMyListing(vendorId, listingId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<VendorListingResponse>> createListing(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody CreateVendorListingRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        VendorListingResponse response = vendorListingService.createListing(
                vendorId, principal.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }

    @PostMapping("/bulk")
    public ResponseEntity<ApiResponse<List<VendorListingResponse>>> bulkPublish(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @Valid @RequestBody BulkCreateVendorListingsRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        List<VendorListingResponse> response = vendorListingService.bulkPublish(
                vendorId, principal.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }

    @PatchMapping("/{listingId}")
    public ResponseEntity<ApiResponse<VendorListingResponse>> updateListing(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID listingId,
            @Valid @RequestBody UpdateVendorListingRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorListingService.updateListing(vendorId, listingId, principal.getUserId(), request)));
    }

    @GetMapping("/{listingId}/images")
    public ResponseEntity<ApiResponse<Map<String, List<String>>>> listListingImages(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID listingId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                Map.of("items", vendorListingService.listVendorListingImageUrls(vendorId, listingId))));
    }

    @PutMapping("/{listingId}/images")
    public ResponseEntity<ApiResponse<Map<String, List<String>>>> setListingImages(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID listingId,
            @Valid @RequestBody SetVendorListingImagesRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        List<String> urls = vendorListingService.setVendorListingImages(vendorId, listingId, request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("items", urls)));
    }

    private void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}
