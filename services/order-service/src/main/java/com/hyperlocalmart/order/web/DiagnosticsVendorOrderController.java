package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsActionRequest;
import com.hyperlocalmart.order.dto.diagnostics.DiagnosticsOrderResponse;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.DiagnosticsOrderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class DiagnosticsVendorOrderController {

    private final DiagnosticsOrderService diagnosticsOrderService;

    @GetMapping("/api/v1/orders/vendor/diagnostics")
    public ResponseEntity<ApiResponse<List<DiagnosticsOrderResponse>>> vendorOrders(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, diagnosticsOrderService.vendorOrders(principal.getUserId())));
    }

    @GetMapping("/api/v1/orders/vendor/diagnostics/my-visits/history/count")
    public ResponseEntity<ApiResponse<Long>> collectorVisitHistoryCount(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsOrderService.collectorVisitHistoryCount(principal.getUserId())));
    }

    @GetMapping("/api/v1/orders/vendor/diagnostics/my-visits/history")
    public ResponseEntity<ApiResponse<List<DiagnosticsOrderResponse>>> collectorVisitHistory(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String q,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsOrderService.collectorVisitHistory(principal.getUserId(), from, to, q)));
    }

    @GetMapping("/api/v1/orders/vendor/diagnostics/{orderId}/report.pdf")
    public ResponseEntity<byte[]> reportPdf(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId) {
        requireVendor(principal);
        byte[] pdf = diagnosticsOrderService.vendorReportPdf(principal.getUserId(), orderId);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"diagnostics-report.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PostMapping("/api/v1/orders/vendor/diagnostics/{orderId}/actions")
    public ResponseEntity<ApiResponse<DiagnosticsOrderResponse>> act(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @Valid @RequestBody DiagnosticsActionRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsOrderService.vendorAct(principal.getUserId(), orderId, request)));
    }

    private static void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}
