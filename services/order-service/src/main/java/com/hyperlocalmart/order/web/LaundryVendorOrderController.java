package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.laundry.LaundryActionRequest;
import com.hyperlocalmart.order.dto.laundry.LaundryOrderResponse;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.LaundryOrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class LaundryVendorOrderController {

    private final LaundryOrderService laundryOrderService;

    @GetMapping("/api/v1/orders/vendor/laundry")
    public ResponseEntity<ApiResponse<List<LaundryOrderResponse>>> vendorOrders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryOrderService.vendorOrders(principal.getUserId())));
    }

    @PostMapping("/api/v1/orders/vendor/laundry/{orderId}/actions")
    public ResponseEntity<ApiResponse<LaundryOrderResponse>> act(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @Valid @RequestBody LaundryActionRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                laundryOrderService.vendorAct(principal.getUserId(), orderId, request)));
    }

    @GetMapping("/api/v1/orders/admin/laundry")
    public ResponseEntity<ApiResponse<List<LaundryOrderResponse>>> adminOrders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryOrderService.adminOrders(townId)));
    }

    private static void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }

    private static void requireAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
