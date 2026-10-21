package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.laundry.LaundryActionRequest;
import com.hyperlocalmart.order.dto.laundry.LaundryOrderResponse;
import com.hyperlocalmart.order.dto.laundry.LaundryShopCard;
import com.hyperlocalmart.order.dto.laundry.PlaceLaundryOrderRequest;
import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.LaundryOrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders/laundry")
@RequiredArgsConstructor
public class LaundryOrderController {

    private final LaundryOrderService laundryOrderService;

    @GetMapping("/shops")
    public ResponseEntity<ApiResponse<List<LaundryShopCard>>> shops(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryOrderService.shops(townId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<LaundryOrderResponse>> place(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody PlaceLaundryOrderRequest request,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, laundryOrderService.place(principal.getUserId(), request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<LaundryOrderResponse>>> mine(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryOrderService.buyerOrders(principal.getUserId(), townId)));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<LaundryOrderResponse>> one(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryOrderService.buyerOrder(principal.getUserId(), orderId)));
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<ApiResponse<LaundryOrderResponse>> cancel(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, laundryOrderService.buyerCancel(principal.getUserId(), orderId)));
    }

    @PostMapping("/{orderId}/complaint")
    public ResponseEntity<ApiResponse<LaundryOrderResponse>> complaint(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        boolean open = body == null || body.get("open") == null || Boolean.parseBoolean(body.get("open"));
        String note = body == null ? null : body.get("note");
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                laundryOrderService.buyerComplaint(principal.getUserId(), orderId, open, note)));
    }

    @PostMapping("/{orderId}/payments/retry")
    public ResponseEntity<ApiResponse<PaymentInfoResponse>> retryPayment(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @RequestParam(value = "gateway", required = false) String gateway,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                laundryOrderService.retryOnlinePayment(principal.getUserId(), orderId, idempotencyKey, gateway)));
    }

    @PostMapping("/{orderId}/comment")
    public ResponseEntity<ApiResponse<LaundryOrderResponse>> comment(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @RequestBody(required = false) Map<String, String> body,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        String comment = body == null ? null : body.get("comment");
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                laundryOrderService.buyerComment(principal.getUserId(), orderId, comment)));
    }

    private static void requireUser(AuthUserPrincipal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Login required");
        }
    }
}
