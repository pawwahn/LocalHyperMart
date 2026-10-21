package com.hyperlocalmart.vendor.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.vendor.dto.request.SaveServiceOfferingRequest;
import com.hyperlocalmart.vendor.dto.response.ServiceOfferingListResponse;
import com.hyperlocalmart.vendor.dto.response.ServiceOfferingResponse;
import com.hyperlocalmart.vendor.security.AuthUserPrincipal;
import com.hyperlocalmart.vendor.service.ServiceOfferingService;
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

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/vendors/services")
@RequiredArgsConstructor
public class ServiceOfferingController {

    private final ServiceOfferingService serviceOfferingService;

    @GetMapping
    public ResponseEntity<ApiResponse<ServiceOfferingListResponse>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, serviceOfferingService.list()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ServiceOfferingResponse>> create(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody SaveServiceOfferingRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, serviceOfferingService.create(request, principal.getUserId())));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<ServiceOfferingResponse>> update(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody SaveServiceOfferingRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(
                httpRequest, serviceOfferingService.update(id, request, principal.getUserId())));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> delete(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID id,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        serviceOfferingService.delete(id);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, null));
    }

    private static void requireAdmin(AuthUserPrincipal principal) {
        if (principal == null
                || (!principal.getRoles().contains("SUPER_ADMIN") && !principal.getRoles().contains("HUB_ADMIN"))) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Admin role required");
        }
    }

    private static void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
