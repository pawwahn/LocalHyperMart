package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.order.dto.request.CancelOrderItemRequest;
import com.hyperlocalmart.order.dto.request.CancelOrderRequest;
import com.hyperlocalmart.order.dto.request.CreateClaimRequest;
import com.hyperlocalmart.order.dto.request.CreateOrderRequest;
import com.hyperlocalmart.order.dto.response.ClaimResponse;
import com.hyperlocalmart.order.dto.response.CreateOrderResponse;
import com.hyperlocalmart.order.dto.response.OrderDetailResponse;
import com.hyperlocalmart.order.dto.response.OrderSummaryResponse;
import com.hyperlocalmart.order.dto.response.ReorderResponse;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.BuyerOrderCancelService;
import com.hyperlocalmart.order.service.OrderClaimService;
import com.hyperlocalmart.order.service.OrderInvoiceService;
import com.hyperlocalmart.order.service.OrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final OrderInvoiceService orderInvoiceService;
    private final BuyerOrderCancelService buyerOrderCancelService;
    private final OrderClaimService orderClaimService;

    @PostMapping
    public ResponseEntity<ApiResponse<CreateOrderResponse>> createOrder(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @Valid @RequestBody CreateOrderRequest request,
            HttpServletRequest httpRequest) {
        CreateOrderResponse response = orderService.createOrder(
                principal.getUserId(), principal.getPhone(), idempotencyKey, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<PageResponse<OrderSummaryResponse>>> listOrders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderService.listOrders(principal.getUserId(), townId, page, size)));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<OrderDetailResponse>> getOrder(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, orderService.getOrder(principal.getUserId(), orderId)));
    }

    @PostMapping("/{orderId}/reorder")
    public ResponseEntity<ApiResponse<ReorderResponse>> reorder(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderService.reorder(principal.getUserId(), orderId)));
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<ApiResponse<OrderDetailResponse>> cancelOrder(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @Valid @RequestBody CancelOrderRequest request,
            HttpServletRequest httpRequest) {
        buyerOrderCancelService.cancelOrder(principal.getUserId(), orderId, request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderService.getOrder(principal.getUserId(), orderId)));
    }

    @PostMapping("/{orderId}/items/{itemId}/cancel")
    public ResponseEntity<ApiResponse<OrderDetailResponse>> cancelItem(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @PathVariable UUID itemId,
            @Valid @RequestBody CancelOrderItemRequest request,
            HttpServletRequest httpRequest) {
        buyerOrderCancelService.cancelItem(principal.getUserId(), orderId, itemId, request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderService.getOrder(principal.getUserId(), orderId)));
    }

    @PostMapping("/{orderId}/claims")
    public ResponseEntity<ApiResponse<ClaimResponse>> createClaim(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @Valid @RequestBody CreateClaimRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                orderClaimService.createClaim(principal.getUserId(), orderId, request)));
    }

    @GetMapping("/{orderId}/claims")
    public ResponseEntity<ApiResponse<List<ClaimResponse>>> listClaims(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                orderClaimService.listBuyerClaims(principal.getUserId(), orderId)));
    }

    @GetMapping("/{orderId}/invoice")
    public ResponseEntity<byte[]> downloadInvoice(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId) {
        OrderInvoiceService.InvoicePdfResult invoice =
                orderInvoiceService.generateInvoice(principal.getUserId(), orderId);
        String filename = invoice.orderNumber().replace('/', '-') + "-invoice.pdf";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(invoice.content());
    }
}
