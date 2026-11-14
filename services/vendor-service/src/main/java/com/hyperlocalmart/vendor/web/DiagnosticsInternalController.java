package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsLabCard;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsLabDetailResponse;
import com.hyperlocalmart.vendor.service.DiagnosticsVendorService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import com.hyperlocalmart.vendor.dto.request.SyncFieldAgentRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/vendors/diagnostics")
@RequiredArgsConstructor
public class DiagnosticsInternalController {

    private final DiagnosticsVendorService diagnosticsVendorService;

    @GetMapping("/labs")
    public ResponseEntity<ApiResponse<List<DiagnosticsLabCard>>> labs(
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, diagnosticsVendorService.listForTown(townId, true)));
    }

    @GetMapping("/labs/{vendorId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> lab(
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, diagnosticsVendorService.getBookable(vendorId)));
    }

    @GetMapping("/by-user/{userId}")
    public ResponseEntity<ApiResponse<Map<String, String>>> byUser(
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        UUID vendorId = diagnosticsVendorService.vendorIdForUser(userId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("vendorId", vendorId.toString())));
    }

    @GetMapping("/staff-context/{userId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> staffContext(
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        DiagnosticsVendorService.StaffContext ctx = diagnosticsVendorService.resolveStaffContext(userId);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of(
                "vendorId", ctx.vendorId(),
                "staffId", ctx.staffId() == null ? "" : ctx.staffId().toString(),
                "roleType", ctx.roleType(),
                "title", ctx.title() == null ? "" : ctx.title(),
                "collectionCapable", ctx.collectionCapable(),
                "vendorOwner", ctx.vendorOwner())));
    }

    @PostMapping("/field-agents/sync")
    public ResponseEntity<ApiResponse<Void>> syncFieldAgent(
            @Valid @RequestBody SyncFieldAgentRequest request,
            HttpServletRequest httpRequest) {
        diagnosticsVendorService.syncFieldAgentFromDelivery(request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }
}
