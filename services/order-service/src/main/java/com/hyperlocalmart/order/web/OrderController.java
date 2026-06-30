package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.order.dto.request.CreateOrderRequest;
import com.hyperlocalmart.order.dto.response.CreateOrderResponse;
import com.hyperlocalmart.order.dto.response.OrderDetailResponse;
import com.hyperlocalmart.order.dto.response.OrderSummaryResponse;
import com.hyperlocalmart.order.dto.response.ReorderResponse;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;
    private final OrderInvoiceService orderInvoiceService;

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
