package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.payment.dto.request.InitiatePaymentRequest;
import com.hyperlocalmart.payment.dto.request.InitiateRefundRequest;
import com.hyperlocalmart.payment.dto.request.OrderIdsBatchRequest;
import com.hyperlocalmart.payment.dto.response.CollectedSuccessBatchItem;
import com.hyperlocalmart.payment.dto.response.CollectedSuccessResponse;
import com.hyperlocalmart.payment.dto.response.PaymentResponse;
import com.hyperlocalmart.payment.dto.response.RefundResponse;
import com.hyperlocalmart.payment.service.PaymentService;
import com.hyperlocalmart.common.api.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class PaymentInternalController {

    private final PaymentService paymentService;

    @PostMapping("/api/v1/internal/payments/initiate")
    public ResponseEntity<ApiResponse<PaymentResponse>> initiateInternal(
            @RequestParam UUID buyerId,
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody InitiatePaymentRequest request,
            HttpServletRequest httpRequest) {
        PaymentResponse response = paymentService.initiate(buyerId, request, idempotencyKey);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }

    @PostMapping("/api/v1/internal/payments/refunds")
    public ResponseEntity<ApiResponse<RefundResponse>> initiateRefundInternal(
            @RequestParam UUID buyerId,
            @Valid @RequestBody InitiateRefundRequest request,
            HttpServletRequest httpRequest) {
        RefundResponse response = paymentService.initiateRefund(buyerId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, response));
    }

    @GetMapping("/api/v1/internal/payments/orders/{orderId}/collected-success")
    public ResponseEntity<ApiResponse<CollectedSuccessResponse>> collectedSuccess(
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        BigDecimal amount = paymentService.sumSuccessfulPaymentsForOrder(orderId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, CollectedSuccessResponse.builder().amount(amount).build()));
    }

    @PostMapping("/api/v1/internal/payments/orders/collected-success/batch")
    public ResponseEntity<ApiResponse<List<CollectedSuccessBatchItem>>> collectedSuccessBatch(
            @RequestBody OrderIdsBatchRequest request,
            HttpServletRequest httpRequest) {
        List<UUID> orderIds = request == null || request.getOrderIds() == null ? List.of() : request.getOrderIds();
        Map<UUID, BigDecimal> sums = paymentService.sumSuccessfulPaymentsForOrders(orderIds);
        List<CollectedSuccessBatchItem> items = new ArrayList<>();
        for (UUID orderId : orderIds) {
            if (orderId == null) {
                continue;
            }
            items.add(CollectedSuccessBatchItem.builder()
                    .orderId(orderId)
                    .amount(sums.getOrDefault(orderId, BigDecimal.ZERO.setScale(2, java.math.RoundingMode.HALF_UP)))
                    .build());
        }
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, items));
    }
}
