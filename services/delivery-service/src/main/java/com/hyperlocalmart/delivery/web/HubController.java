package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.response.HubDashboardResponse;
import com.hyperlocalmart.delivery.dto.response.HubMeResponse;
import com.hyperlocalmart.delivery.dto.response.HubReportResponse;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.HubDashboardService;
import com.hyperlocalmart.delivery.service.HubReportService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/delivery/hubs")
@RequiredArgsConstructor
public class HubController {

    private final HubDashboardService hubDashboardService;
    private final HubReportService hubReportService;

    @GetMapping("/me")
    public ResponseEntity<ApiResponse<HubMeResponse>> getMyHub(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                hubDashboardService.getMyHub(principal.getUserId())));
    }

    @GetMapping("/{hubId}/dashboard")
    public ResponseEntity<ApiResponse<HubDashboardResponse>> getDashboard(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID hubId,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                hubDashboardService.getDashboard(principal.getUserId(), hubId)));
    }

    @GetMapping("/{hubId}/reports")
    public ResponseEntity<ApiResponse<HubReportResponse>> getReport(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID hubId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireHubAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                hubReportService.getReport(principal.getUserId(), hubId, from, to)));
    }

    private void requireHubAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("HUB_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
        }
    }
}
