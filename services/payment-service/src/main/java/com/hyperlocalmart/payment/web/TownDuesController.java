package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.dto.response.TownDuesResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.security.PlatformAdminPrincipalAuth;
import com.hyperlocalmart.payment.service.TownDuesService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class TownDuesController {

    private final TownDuesService townDuesService;

    @GetMapping("/api/v1/payments/admin/town-dues")
    public ResponseEntity<ApiResponse<TownDuesResponse>> townDues(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) UUID townId,
            @RequestParam(defaultValue = "true") boolean includeOpenWork,
            @RequestParam(defaultValue = "false") boolean openWorkOnly,
            @RequestParam(required = false) String openWorkActions,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireStaff(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                townDuesService.dues(from, to, townId, includeOpenWork, openWorkOnly, openWorkActions)));
    }
}
