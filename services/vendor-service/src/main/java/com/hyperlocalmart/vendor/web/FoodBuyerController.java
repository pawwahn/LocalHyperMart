package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.vendor.dto.response.FoodHotelCardResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.FoodVendorService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/food")
@RequiredArgsConstructor
public class FoodBuyerController {

    private final FoodVendorService foodVendorService;

    @GetMapping("/towns/{townId}/hotels")
    public ResponseEntity<ApiResponse<List<FoodHotelCardResponse>>> listHotels(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID townId,
            @RequestParam(defaultValue = "true") boolean bookableOnly,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, foodVendorService.listForTown(townId, bookableOnly)));
    }

    @GetMapping("/hotels/{vendorId}")
    public ResponseEntity<ApiResponse<FoodHotelCardResponse>> hotel(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, foodVendorService.getBookableHotel(vendorId)));
    }
}