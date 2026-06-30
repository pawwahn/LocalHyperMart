package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.dto.request.DeliverOrderRequest;
import com.hyperlocalmart.order.dto.request.PaymentCallbackRequest;
import com.hyperlocalmart.order.dto.response.OrderDeliveryInfoResponse;
import com.hyperlocalmart.order.dto.response.OrderInternalSnapshotResponse;
import com.hyperlocalmart.order.dto.response.SubOrderInternalSnapshotResponse;
import com.hyperlocalmart.order.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class OrderInternalController {

    private final OrderService orderService;

    @GetMapping("/api/v1/internal/orders/{orderId}")
    public ResponseEntity<ApiResponse<OrderInternalSnapshotResponse>> getOrderSnapshot(
            @PathVariable UUID orderId,
            @RequestParam UUID buyerId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, orderService.getOrderSnapshot(orderId, buyerId)));
    }

    @GetMapping("/api/v1/internal/orders/sub-orders/{subOrderId}")
    public ResponseEntity<ApiResponse<SubOrderInternalSnapshotResponse>> getSubOrderSnapshot(
            @PathVariable UUID subOrderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, orderService.getSubOrderSnapshot(subOrderId)));
    }

    @GetMapping("/api/v1/internal/orders/{orderId}/delivery-info")
    public ResponseEntity<ApiResponse<OrderDeliveryInfoResponse>> getDeliveryInfo(
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, orderService.getDeliveryInfo(orderId)));
    }

    @PostMapping("/api/v1/internal/orders/{orderId}/delivered")
    public ResponseEntity<Void> markDelivered(
            @PathVariable UUID orderId,
            @Valid @RequestBody DeliverOrderRequest request) {
        orderService.markDelivered(orderId, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/internal/orders/{orderId}/payment-success")
    public ResponseEntity<Void> paymentSuccess(
            @PathVariable UUID orderId,
            @Valid @RequestBody PaymentCallbackRequest request) {
        orderService.markPaymentSuccess(orderId, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/internal/orders/{orderId}/payment-failed")
    public ResponseEntity<Void> paymentFailed(
            @PathVariable UUID orderId,
            @Valid @RequestBody PaymentCallbackRequest request) {
        orderService.markPaymentFailed(orderId, request);
        return ResponseEntity.noContent().build();
    }
}
