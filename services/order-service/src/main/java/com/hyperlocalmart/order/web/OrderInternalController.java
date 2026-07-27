package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.order.dto.request.DeliverOrderRequest;
import com.hyperlocalmart.order.dto.request.PaymentCallbackRequest;
import com.hyperlocalmart.order.dto.response.CodDeliveredResponse;
import com.hyperlocalmart.order.dto.response.HubOrderStatsResponse;
import com.hyperlocalmart.order.dto.response.HubTownReportStatsResponse;
import com.hyperlocalmart.order.dto.response.OrderDeliveryInfoResponse;
import com.hyperlocalmart.order.dto.response.OrderInternalSnapshotResponse;
import com.hyperlocalmart.order.dto.response.SettlementCandidateResponse;
import com.hyperlocalmart.order.dto.response.SubOrderInternalSnapshotResponse;
import com.hyperlocalmart.order.dto.response.SubOrderPickupManifestResponse;
import com.hyperlocalmart.order.service.CodDeliveredService;
import com.hyperlocalmart.order.service.HubOrderStatsService;
import com.hyperlocalmart.order.service.OrderService;
import com.hyperlocalmart.order.service.SettlementCandidateService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class OrderInternalController {

    private final OrderService orderService;
    private final HubOrderStatsService hubOrderStatsService;
    private final SettlementCandidateService settlementCandidateService;
    private final CodDeliveredService codDeliveredService;

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

    @GetMapping("/api/v1/internal/orders/sub-orders/{subOrderId}/pickup-manifest")
    public ResponseEntity<ApiResponse<SubOrderPickupManifestResponse>> getPickupManifest(
            @PathVariable UUID subOrderId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, orderService.getPickupManifest(subOrderId)));
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

    @GetMapping("/api/v1/internal/towns/{townId}/hub-order-stats")
    public ResponseEntity<ApiResponse<HubOrderStatsResponse>> getHubOrderStats(
            @PathVariable UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, hubOrderStatsService.getHubOrderStats(townId)));
    }

    @GetMapping("/api/v1/internal/towns/{townId}/hub-report-stats")
    public ResponseEntity<ApiResponse<HubTownReportStatsResponse>> getHubReportStats(
            @PathVariable UUID townId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                hubOrderStatsService.getTownReportStats(townId, from, to)));
    }

    @GetMapping("/api/v1/internal/orders/settlement-candidates")
    public ResponseEntity<ApiResponse<SettlementCandidateResponse>> getSettlementCandidates(
            @RequestParam UUID vendorId,
            @RequestParam UUID townId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementCandidateService.listCandidates(vendorId, townId, from, to)));
    }

    @PostMapping("/api/v1/internal/orders/settlement-candidates/resolve")
    public ResponseEntity<ApiResponse<List<SettlementCandidateResponse.Item>>> resolveSettlementSubOrders(
            @RequestParam UUID vendorId,
            @RequestBody List<UUID> subOrderIds,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                settlementCandidateService.resolveSubOrders(vendorId, subOrderIds)));
    }

    /**
     * COD orders delivered on the given IST calendar day.
     * Optional agentId filters by LAST_MILE assignment when delivery data is available;
     * otherwise returns town-level COD delivered (Gate A limitation).
     */
    @GetMapping("/api/v1/internal/orders/cod-delivered")
    public ResponseEntity<ApiResponse<CodDeliveredResponse>> listCodDelivered(
            @RequestParam UUID townId,
            @RequestParam(required = false) UUID agentId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                codDeliveredService.list(townId, agentId, date)));
    }

    @PostMapping("/api/v1/internal/orders/cod-delivered/resolve")
    public ResponseEntity<ApiResponse<List<CodDeliveredResponse.Item>>> resolveCodDelivered(
            @RequestBody List<UUID> orderIds,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, codDeliveredService.resolve(orderIds)));
    }
}
