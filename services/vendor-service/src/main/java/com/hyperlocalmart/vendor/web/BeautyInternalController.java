package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.vendor.dto.response.BeautyArtistResponse;
import com.hyperlocalmart.vendor.service.BeautyVendorService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import com.hyperlocalmart.vendor.dto.request.ApplyBeautyRatingAggregateRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/vendors/beauty")
@RequiredArgsConstructor
public class BeautyInternalController {

    private final BeautyVendorService beautyVendorService;

    @GetMapping("/artists")
    public ResponseEntity<ApiResponse<List<BeautyArtistResponse>>> artists(
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyVendorService.listForTown(townId, true)));
    }

    @GetMapping("/artists/{vendorId}")
    public ResponseEntity<ApiResponse<BeautyArtistResponse>> artist(
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyVendorService.getBookable(vendorId)));
    }

    @GetMapping("/by-user/{userId}")
    public ResponseEntity<ApiResponse<Map<String, String>>> byUser(
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        UUID vendorId = beautyVendorService.vendorIdForUser(userId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("vendorId", vendorId.toString())));
    }

    @PostMapping("/artists/{vendorId}/rating-aggregate")
    public ResponseEntity<ApiResponse<Void>> ratingAggregate(
            @PathVariable UUID vendorId,
            @RequestBody ApplyBeautyRatingAggregateRequest request,
            HttpServletRequest httpRequest) {
        beautyVendorService.applyRatingAggregate(vendorId, request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }
}
