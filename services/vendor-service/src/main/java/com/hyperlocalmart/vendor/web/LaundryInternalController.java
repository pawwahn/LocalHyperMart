package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.vendor.dto.response.LaundryShopResponse;
import com.hyperlocalmart.vendor.service.LaundryVendorService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/vendors/laundry")
@RequiredArgsConstructor
public class LaundryInternalController {

    private final LaundryVendorService laundryVendorService;

    @GetMapping("/shops")
    public ResponseEntity<ApiResponse<List<LaundryShopResponse>>> shops(
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryVendorService.listForTown(townId, true)));
    }

    @GetMapping("/shops/{vendorId}")
    public ResponseEntity<ApiResponse<LaundryShopResponse>> shop(
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryVendorService.getBookable(vendorId)));
    }

    @GetMapping("/by-user/{userId}")
    public ResponseEntity<ApiResponse<Map<String, String>>> byUser(
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        UUID vendorId = laundryVendorService.vendorIdForUser(userId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("vendorId", vendorId.toString())));
    }
}
