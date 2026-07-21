package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.order.dto.request.CancelOrderItemRequest;
import com.hyperlocalmart.order.dto.request.RejectSubOrderRequest;
import com.hyperlocalmart.order.dto.response.VendorSubOrderResponse;
import com.hyperlocalmart.order.entity.VendorSubOrderStatus;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.VendorSubOrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders/vendor/sub-orders")
@RequiredArgsConstructor
public class VendorSubOrderController {

    private final VendorSubOrderService vendorSubOrderService;

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<VendorSubOrderResponse>>> listSubOrders(
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @RequestParam(required = false) VendorSubOrderStatus status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorSubOrderService.listSubOrders(vendorId, status, page, size)));
    }

    @GetMapping("/{subOrderId}")
    public ResponseEntity<ApiResponse<VendorSubOrderResponse>> getSubOrder(
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID subOrderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorSubOrderService.getSubOrder(vendorId, subOrderId)));
    }

    @PostMapping("/{subOrderId}/ready")
    public ResponseEntity<ApiResponse<VendorSubOrderResponse>> markReady(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID subOrderId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorSubOrderService.markReady(vendorId, subOrderId, principal.getUserId())));
    }

    @PostMapping("/{subOrderId}/reject")
    public ResponseEntity<ApiResponse<VendorSubOrderResponse>> reject(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID subOrderId,
            @Valid @RequestBody RejectSubOrderRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorSubOrderService.reject(vendorId, subOrderId, principal.getUserId(), request)));
    }

    @PostMapping("/{subOrderId}/items/{itemId}/cancel")
    public ResponseEntity<ApiResponse<VendorSubOrderResponse>> cancelItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @PathVariable UUID subOrderId,
            @PathVariable UUID itemId,
            @Valid @RequestBody CancelOrderItemRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorSubOrderService.cancelItem(
                        vendorId, subOrderId, itemId, principal.getUserId(), request)));
    }

    private void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new com.hyperlocalmart.common.exception.BusinessException(
                    com.hyperlocalmart.common.exception.ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}
