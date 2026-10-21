package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.GatewayAdminRequest;
import com.hyperlocalmart.payment.dto.response.GatewayAdminResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.PaymentGatewayConfigService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/payments/admin/gateways")
@RequiredArgsConstructor
public class PaymentGatewayAdminController {

    private final PaymentGatewayConfigService paymentGatewayConfigService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<GatewayAdminResponse>>> list(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, paymentGatewayConfigService.current()));
    }

    @PutMapping
    public ResponseEntity<ApiResponse<List<GatewayAdminResponse>>> save(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @Valid @RequestBody List<@Valid GatewayAdminRequest> body,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                paymentGatewayConfigService.save(body, principal.getUserId())));
    }

    private static void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
