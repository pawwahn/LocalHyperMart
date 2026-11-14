package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsPackageRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsProfileRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsTestRequest;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsLabCard;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsLabDetailResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.security.PlatformAdminPrincipalAuth;
import com.hyperlocalmart.vendor.service.DiagnosticsVendorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/diagnostics")
@RequiredArgsConstructor
public class DiagnosticsAdminController {

    private final DiagnosticsVendorService diagnosticsVendorService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<DiagnosticsLabCard>>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam UUID townId,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireStaff(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, diagnosticsVendorService.listForTown(townId, false)));
    }

    @GetMapping("/{vendorId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> get(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireStaff(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, diagnosticsVendorService.get(vendorId)));
    }

    @PutMapping("/{vendorId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> upsert(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody UpsertDiagnosticsProfileRequest request,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireWrite(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.upsertByAdmin(vendorId, principal.getUserId(), request)));
    }

    @PostMapping("/{vendorId}/tests")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> createTest(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody UpsertDiagnosticsTestRequest request,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireWrite(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.adminCreateTest(vendorId, principal.getUserId(), request)));
    }

    @PutMapping("/{vendorId}/tests/{testId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> updateTest(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @PathVariable UUID testId,
            @Valid @RequestBody UpsertDiagnosticsTestRequest request,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireWrite(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.adminUpdateTest(vendorId, principal.getUserId(), testId, request)));
    }

    @PostMapping("/{vendorId}/packages")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> createPackage(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @Valid @RequestBody UpsertDiagnosticsPackageRequest request,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireWrite(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.adminCreatePackage(vendorId, principal.getUserId(), request)));
    }

    @PutMapping("/{vendorId}/packages/{packageId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> updatePackage(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID vendorId,
            @PathVariable UUID packageId,
            @Valid @RequestBody UpsertDiagnosticsPackageRequest request,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireWrite(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.adminUpdatePackage(vendorId, principal.getUserId(), packageId, request)));
    }

}
