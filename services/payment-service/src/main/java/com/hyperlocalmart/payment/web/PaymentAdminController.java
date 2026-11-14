package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.dto.response.AdminOrderPaymentsResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.security.PlatformAdminPrincipalAuth;
import com.hyperlocalmart.payment.service.PaymentAdminLookupService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments/admin")
@RequiredArgsConstructor
public class PaymentAdminController {

    private final PaymentAdminLookupService paymentAdminLookupService;

    @GetMapping("/order-payments")
    public ResponseEntity<ApiResponse<AdminOrderPaymentsResponse>> orderPayments(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @RequestParam("q") String query,
            HttpServletRequest httpRequest) {
        PlatformAdminPrincipalAuth.requireStaff(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, paymentAdminLookupService.lookup(query)));
    }
}
