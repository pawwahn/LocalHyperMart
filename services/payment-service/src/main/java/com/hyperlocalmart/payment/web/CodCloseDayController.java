package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.CreateCodCloseDayRequest;
import com.hyperlocalmart.payment.dto.response.CodCandidateResponse;
import com.hyperlocalmart.payment.dto.response.CodCloseDayResponse;
import com.hyperlocalmart.payment.dto.response.CodSummaryResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.CodCloseDayService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/cod")
@RequiredArgsConstructor
public class CodCloseDayController {

    private static final ZoneId IST = ZoneId.of("Asia/Kolkata");

    private final CodCloseDayService codCloseDayService;

    @PostMapping("/close-day")
    public ResponseEntity<ApiResponse<CodCloseDayResponse>> closeDay(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateCodCloseDayRequest request,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                codCloseDayService.closeDay(request, principal.getUserId(), isSuperAdmin(principal))));
    }

    @GetMapping("/candidates")
    public ResponseEntity<ApiResponse<CodCandidateResponse>> candidates(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam UUID hubId,
            @RequestParam UUID agentId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                codCloseDayService.listCandidates(
                        townId, hubId, agentId, date, principal.getUserId(), isSuperAdmin(principal))));
    }

    @GetMapping("/summary")
    public ResponseEntity<ApiResponse<CodSummaryResponse>> summary(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam UUID hubId,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                codCloseDayService.summary(
                        townId, hubId, date, principal.getUserId(), isSuperAdmin(principal))));
    }

    @GetMapping("/closes")
    public ResponseEntity<ApiResponse<Map<String, List<CodCloseDayResponse>>>> listCloses(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            @RequestParam UUID hubId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            HttpServletRequest httpRequest) {
        requireHubOrSuperAdmin(principal);
        LocalDate rangeTo = to != null ? to : LocalDate.now(IST);
        LocalDate rangeFrom = from != null ? from : rangeTo;
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "items", codCloseDayService.listCloses(
                        townId, hubId, rangeFrom, rangeTo, principal.getUserId(), isSuperAdmin(principal)))));
    }

    private void requireHubOrSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null
                || (!principal.getRoles().contains("HUB_ADMIN")
                && !principal.getRoles().contains("SUPER_ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin or super admin role required");
        }
    }

    private static boolean isSuperAdmin(AuthUserPrincipal principal) {
        return principal != null && principal.getRoles().contains("SUPER_ADMIN");
    }
}
