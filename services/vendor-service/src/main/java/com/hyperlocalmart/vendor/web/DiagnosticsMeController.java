package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsBranchRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsProfileRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsStaffRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsPackageRequest;
import com.hyperlocalmart.vendor.dto.request.UpsertDiagnosticsTestRequest;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsLabDetailResponse;
import com.hyperlocalmart.vendor.dto.response.DiagnosticsStaffSessionResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.DiagnosticsVendorService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/me/diagnostics")
@RequiredArgsConstructor
public class DiagnosticsMeController {

    private final DiagnosticsVendorService diagnosticsVendorService;

    @GetMapping
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> getMe(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, diagnosticsVendorService.getForUser(principal.getUserId())));
    }

    @GetMapping("/session")
    public ResponseEntity<ApiResponse<DiagnosticsStaffSessionResponse>> session(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.staffSessionForUser(principal.getUserId())));
    }

    @GetMapping("/audit")
    public ResponseEntity<ApiResponse<List<DiagnosticsLabDetailResponse.AuditRow>>> audit(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.auditForUser(principal.getUserId())));
    }

    @PutMapping("/profile")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> upsertProfile(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertDiagnosticsProfileRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.upsertProfileByVendor(principal.getUserId(), request)));
    }

    @PostMapping("/branches")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> createBranch(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertDiagnosticsBranchRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.createBranch(principal.getUserId(), request)));
    }

    @PutMapping("/branches/{branchId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> updateBranch(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID branchId,
            @Valid @RequestBody UpsertDiagnosticsBranchRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.updateBranch(principal.getUserId(), branchId, request)));
    }

    @DeleteMapping("/branches/{branchId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> deleteBranch(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID branchId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.deleteBranch(principal.getUserId(), branchId)));
    }

    @PostMapping("/tests")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> createTest(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertDiagnosticsTestRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.createTest(principal.getUserId(), request)));
    }

    @PutMapping("/tests/{testId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> updateTest(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID testId,
            @Valid @RequestBody UpsertDiagnosticsTestRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.updateTest(principal.getUserId(), testId, request)));
    }

    @DeleteMapping("/tests/{testId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> deleteTest(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID testId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.deleteTest(principal.getUserId(), testId)));
    }

    @PostMapping("/packages")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> createPackage(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertDiagnosticsPackageRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.createPackage(principal.getUserId(), request)));
    }

    @PutMapping("/packages/{packageId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> updatePackage(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID packageId,
            @Valid @RequestBody UpsertDiagnosticsPackageRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.updatePackage(principal.getUserId(), packageId, request)));
    }

    @DeleteMapping("/packages/{packageId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> deletePackage(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID packageId,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.deletePackage(principal.getUserId(), packageId)));
    }

    @PostMapping("/staff")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> createStaff(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody UpsertDiagnosticsStaffRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.createStaff(principal.getUserId(), request)));
    }

    @PutMapping("/staff/{staffId}")
    public ResponseEntity<ApiResponse<DiagnosticsLabDetailResponse>> updateStaff(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID staffId,
            @Valid @RequestBody UpsertDiagnosticsStaffRequest request,
            HttpServletRequest httpRequest) {
        requireVendor(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                diagnosticsVendorService.updateStaff(principal.getUserId(), staffId, request)));
    }

    private static void requireVendor(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("VENDOR")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Vendor role required");
        }
    }
}
