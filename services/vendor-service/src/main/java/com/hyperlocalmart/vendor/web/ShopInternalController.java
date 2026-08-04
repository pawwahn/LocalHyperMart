package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.web.CorrelationIdFilter;
import com.hyperlocalmart.vendor.dto.request.ShopBatchRequest;
import com.hyperlocalmart.vendor.dto.response.ShopSummaryResponse;
import com.hyperlocalmart.vendor.dto.response.VendorShopContextResponse;
import com.hyperlocalmart.vendor.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;

@RestController
@RequiredArgsConstructor
public class ShopInternalController {

    private final ShopService shopService;

    @PostMapping("/api/v1/internal/shops/batch")
    public ResponseEntity<ApiResponse<List<ShopSummaryResponse>>> batchLookup(
            @Valid @RequestBody ShopBatchRequest request,
            HttpServletRequest httpRequest) {
        List<ShopSummaryResponse> shops = shopService.getShopsByIds(request.getShopIds());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, shops));
    }

    @GetMapping("/api/v1/internal/shops/{shopId}")
    public ResponseEntity<ApiResponse<ShopSummaryResponse>> getShop(
            @PathVariable java.util.UUID shopId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, shopService.getShopById(shopId)));
    }

    @GetMapping("/api/v1/internal/vendors/{vendorId}/shop-context")
    public ResponseEntity<ApiResponse<VendorShopContextResponse>> getVendorShopContext(
            @PathVariable java.util.UUID vendorId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, shopService.getShopContextForVendor(vendorId)));
    }
}
