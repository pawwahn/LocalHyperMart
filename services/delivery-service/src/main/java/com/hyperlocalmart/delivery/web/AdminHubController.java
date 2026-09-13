package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.request.CreateHubRequest;
import com.hyperlocalmart.delivery.dto.request.UpdateHubRequest;
import com.hyperlocalmart.delivery.dto.response.AdminHubResponse;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.HubOnboardingService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/delivery/admin/hubs")
@RequiredArgsConstructor
public class AdminHubController {

    private final HubOnboardingService hubOnboardingService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<AdminHubResponse>>> listHubs(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, hubOnboardingService.listHubs()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<AdminHubResponse>> createHub(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody CreateHubRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        AdminHubResponse response = hubOnboardingService.createHub(principal.getUserId(), request);
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, "Hub created", response));
    }

    @GetMapping("/{hubId}")
    public ResponseEntity<ApiResponse<AdminHubResponse>> getHub(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID hubId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, hubOnboardingService.getHub(hubId)));
    }

    @PatchMapping("/{hubId}")
    public ResponseEntity<ApiResponse<AdminHubResponse>> updateHub(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID hubId,
            @Valid @RequestBody UpdateHubRequest request,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        AdminHubResponse response = hubOnboardingService.updateHub(principal.getUserId(), hubId, request);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, "Hub updated", response));
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
