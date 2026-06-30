package com.hyperlocalmart.delivery.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.delivery.dto.request.OtpOverrideRequest;
import com.hyperlocalmart.delivery.security.AuthUserPrincipal;
import com.hyperlocalmart.delivery.service.AssignmentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/delivery/orders")
@RequiredArgsConstructor
public class DeliveryOrderController {

    private final AssignmentService assignmentService;

    @PostMapping("/{orderId}/otp-override")
    public ResponseEntity<ApiResponse<Map<String, String>>> overrideOtp(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID orderId,
            @Valid @RequestBody OtpOverrideRequest request,
            HttpServletRequest httpRequest) {
        if (principal == null || !principal.getRoles().contains("HUB_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Hub admin role required");
        }
        String otp = assignmentService.overrideOtp(principal.getUserId(), orderId, request.getReason());
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, Map.of("otp", otp)));
    }
}
