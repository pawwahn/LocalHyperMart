package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsLabCard;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsShopDetail;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsOrderResponse;
import com.hyperlocalmart.order.dto.diagnostics.PlaceDiagnosticsOrderRequest;
import com.hyperlocalmart.order.dto.response.PaymentInfoResponse;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.DiagnosticsOrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders/diagnostics")
@RequiredArgsConstructor
public class DiagnosticsOrderController {

    private final DiagnosticsOrderService diagnosticsOrderService;

    @GetMapping({ "/shops", "/labs" })
    public ResponseEntity<ApiResponse<List<DiagnosticsLabCard>>> shops(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, diagnosticsOrderService.shops(townId)));
    }

    @GetMapping("/shops/{vendorId}")
    public ResponseEntity<ApiResponse<DiagnosticsShopDetail>> shopDetail(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @RequestParam UUID townId,
            @RequestParam UUID addressId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsOrderService.shopDetail(principal.getUserId(), townId, vendorId, addressId)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DiagnosticsOrderResponse>> place(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody PlaceDiagnosticsOrderRequest request,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                diagnosticsOrderService.place(principal.getUserId(), principal.getPhone(), request)));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<DiagnosticsOrderResponse>>> myOrders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsOrderService.buyerOrders(principal.getUserId(), townId)));
    }

    @GetMapping("/{orderId}")
    public ResponseEntity<ApiResponse<DiagnosticsOrderResponse>> myOrder(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsOrderService.buyerOrder(principal.getUserId(), orderId)));
    }

    @GetMapping("/{orderId}/report.pdf")
    public ResponseEntity<byte[]> reportPdf(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId) {
        requireUser(principal);
        byte[] pdf = diagnosticsOrderService.buyerReportPdf(principal.getUserId(), orderId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"diagnostics-report.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @GetMapping("/{orderId}/report-files/{mediaId}")
    public ResponseEntity<byte[]> reportFile(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @PathVariable UUID mediaId) {
        requireUser(principal);
        var file = diagnosticsOrderService.buyerReportAttachment(principal.getUserId(), orderId, mediaId);
        String disposition = file.contentType() != null && file.contentType().contains("pdf")
                ? "attachment"
                : "inline";
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"lab-report-" + mediaId + "\"")
                .contentType(MediaType.parseMediaType(file.contentType()))
                .body(file.bytes());
    }

    @PostMapping("/{orderId}/cancel")
    public ResponseEntity<ApiResponse<DiagnosticsOrderResponse>> cancel(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            HttpServletRequest httpRequest) {
        requireUser(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsOrderService.buyerCancel(principal.getUserId(), orderId)));
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
                diagnosticsOrderService.retryOnlinePayment(
                        principal.getUserId(), principal.getPhone(), orderId, idempotencyKey, gateway)));
    }

    private static void requireUser(AuthUserPrincipal principal) {
        if (principal == null) {
            throw new BusinessException(ErrorCode.UNAUTHORIZED, "Login required");
        }
    }
}
