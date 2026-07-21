package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpdateShopAcceptingOrdersRequest;
import com.hyperlocalmart.vendor.dto.request.UpdateShopProfileRequest;
import com.hyperlocalmart.vendor.dto.response.VendorShopStatusResponse;
import com.hyperlocalmart.vendor.service.ShopService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/me/shop")
@RequiredArgsConstructor
public class VendorShopController {

    private final ShopService shopService;

    @GetMapping
    public ResponseEntity<ApiResponse<VendorShopStatusResponse>> getMyShop(
            @RequestHeader(value = "X-Vendor-Id", required = false) UUID vendorId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, shopService.getShopStatusForVendor(requireVendorId(vendorId))));
    }

    @PatchMapping
    public ResponseEntity<ApiResponse<VendorShopStatusResponse>> updateMyShop(
            @RequestHeader(value = "X-Vendor-Id", required = false) UUID vendorId,
            @Valid @RequestBody UpdateShopProfileRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest,
                shopService.updateShopProfile(requireVendorId(vendorId), request)));
    }

    @PatchMapping("/accepting-orders")
    public ResponseEntity<ApiResponse<VendorShopStatusResponse>> setAcceptingOrders(
            @RequestHeader(value = "X-Vendor-Id", required = false) UUID vendorId,
            @Valid @RequestBody UpdateShopAcceptingOrdersRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest,
                shopService.setAcceptingOrders(requireVendorId(vendorId), Boolean.TRUE.equals(request.getAcceptingOrders()))));
    }

    private static UUID requireVendorId(UUID vendorId) {
        if (vendorId == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "X-Vendor-Id header is required");
        }
        return vendorId;
    }
}
