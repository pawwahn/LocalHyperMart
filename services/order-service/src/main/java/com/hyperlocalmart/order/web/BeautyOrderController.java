package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.beauty.BeautyArtistCard;
import com.hyperlocalmart.order.dto.beauty.BeautyAvailabilityResponse;
import com.hyperlocalmart.order.dto.beauty.BeautyOrderResponse;
import com.hyperlocalmart.order.dto.beauty.PlaceBeautyOrderRequest;
import com.hyperlocalmart.order.dto.beauty.BeautyVendorReviewsPageResponse;
import com.hyperlocalmart.order.dto.beauty.RateBeautyOrderRequest;
import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.BeautyOrderService;
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

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders/beauty")
@RequiredArgsConstructor
public class BeautyOrderController {

    private final BeautyOrderService beautyOrderService;

    @GetMapping("/availability")
    public ResponseEntity<ApiResponse<BeautyAvailabilityResponse>> availability(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID vendorId,
            @RequestParam(required = false) String date,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        LocalDate day = date == null || date.isBlank() ? null : LocalDate.parse(date.trim());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyOrderService.availability(vendorId, day)));
    }

    @GetMapping("/vendors/{vendorId}/reviews")
    public ResponseEntity<ApiResponse<BeautyVendorReviewsPageResponse>> vendorReviews(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "12") int size,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyOrderService.vendorReviews(vendorId, page, size)));
    }

    @GetMapping("/artists")
    public ResponseEntity<ApiResponse<List<BeautyArtistCard>>> artists(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyOrderService.artists(townId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<BeautyOrderResponse>> place(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody PlaceBeautyOrderRequest request,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, beautyOrderService.place(
                        principal.getUserId(), principal.getPhone(), request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<BeautyOrderResponse>>> mine(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyOrderService.buyerOrders(principal.getUserId(), townId)));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<BeautyOrderResponse>> one(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyOrderService.buyerOrder(principal.getUserId(), orderId)));
    }

    @PostMapping("/{orderId}/rating")
    public ResponseEntity<ApiResponse<BeautyOrderResponse>> rate(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @Valid @RequestBody RateBeautyOrderRequest request,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                beautyOrderService.rateBooking(principal.getUserId(), orderId, request)));
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<ApiResponse<BeautyOrderResponse>> cancel(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, beautyOrderService.buyerCancel(principal.getUserId(), orderId)));
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
                beautyOrderService.retryOnlinePayment(
                        principal.getUserId(), principal.getPhone(), orderId, idempotencyKey, gateway)));
    }

    private static void requireUser(AuthUserPrincipal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Login required");
        }
    }
}
