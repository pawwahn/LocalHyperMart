package com.hyperlocalmart.order.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.order.dto.response.VendorDashboardResponse;
import com.hyperlocalmart.order.dto.response.VendorGstReportResponse;
import com.hyperlocalmart.order.dto.response.VendorSalesReportResponse;
import com.hyperlocalmart.order.entity.PaymentStatus;
import com.hyperlocalmart.order.security.AuthUserPrincipal;
import com.hyperlocalmart.order.service.VendorDashboardService;
import com.hyperlocalmart.order.service.VendorGstReportService;
import com.hyperlocalmart.order.service.VendorSalesReportService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/orders/vendor")
@RequiredArgsConstructor
public class VendorDashboardController {

    private final VendorDashboardService vendorDashboardService;
    private final VendorSalesReportService vendorSalesReportService;
    private final VendorGstReportService vendorGstReportService;

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<VendorDashboardResponse>> getDashboard(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorDashboardService.getDashboard(vendorId, from, to)));
    }

    /**
     * Sales report for a vendor across today / week / month / custom date ranges.
     * Includes payment status (amount received vs pending) and optional line items.
     */
    @GetMapping("/sales-report")
    public ResponseEntity<ApiResponse<VendorSalesReportResponse>> getSalesReport(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "false") boolean includeItems,
            @RequestParam(required = false) PaymentStatus paymentStatus,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorSalesReportService.getSalesReport(vendorId, from, to, includeItems, paymentStatus)));
    }

    /**
     * Outward supplies (delivered bags) for GST return working: HSN summary, B2C document register, optional line detail.
     */
    @GetMapping("/gst-report")
    public ResponseEntity<ApiResponse<VendorGstReportResponse>> getGstReport(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestHeader("X-Vendor-Id") UUID vendorId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "true") boolean includeLines,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                vendorGstReportService.getReport(vendorId, from, to, includeLines)));
    }

    private void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}
