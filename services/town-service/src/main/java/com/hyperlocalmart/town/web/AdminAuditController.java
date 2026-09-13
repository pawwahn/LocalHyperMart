package com.hyperlocalmart.town.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.api.PageResponse;
import com.hyperlocalmart.town.dto.request.AdminAuditAppendRequest;
import com.hyperlocalmart.town.dto.response.AdminAuditEntryResponse;
import com.hyperlocalmart.town.service.AdminAuditService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class AdminAuditController {

    private final AdminAuditService adminAuditService;

    @GetMapping("/api/v1/platform/admin-audit")
    public ResponseEntity<ApiResponse<PageResponse<AdminAuditEntryResponse>>> list(
            @RequestParam String screen,
            @RequestParam(required = false) UUID townId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) Instant from,
            @RequestParam(required = false) Instant to,
            @RequestParam(required = false) String q,
            HttpServletRequest httpRequest) {
        AdminAuth.requireSuperAdmin(httpRequest);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                adminAuditService.list(screen, townId, page, size, from, to, q)));
    }

    @PostMapping("/api/v1/internal/admin-audit")
    public ResponseEntity<ApiResponse<Void>> append(
            @RequestBody AdminAuditAppendRequest request,
            HttpServletRequest httpRequest) {
        adminAuditService.record(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest, null));
    }
}
