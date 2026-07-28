package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.response.WalletBalanceResponse;
import com.hyperlocalmart.payment.dto.response.WalletTransactionListResponse;
import com.hyperlocalmart.payment.security.AuthUserPrincipal;
import com.hyperlocalmart.payment.service.WalletService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/payments/admin/wallet")
@RequiredArgsConstructor
public class WalletAdminController {

    private final WalletService walletService;

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<WalletBalanceResponse>> balance(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, walletService.getBalance(userId)));
    }

    @GetMapping("/{userId}/transactions")
    public ResponseEntity<ApiResponse<WalletTransactionListResponse>> transactions(
            @AuthenticationPrincipal AuthUserPrincipal principal,
            @PathVariable UUID userId,
            @RequestParam(defaultValue = "40") int limit,
            @RequestParam(defaultValue = "0") int offset,
            HttpServletRequest httpRequest) {
        requireSuperAdmin(principal);
        return ResponseEntity.ok(ApiResponses.ok(httpRequest,
                walletService.listTransactions(userId, limit, offset)));
    }

    private void requireSuperAdmin(AuthUserPrincipal principal) {
        if (principal == null || principal.getRoles() == null || !principal.getRoles().contains("SUPER_ADMIN")) {
            throw new BusinessException(ErrorCode.FORBIDDEN, "Super admin role required");
        }
    }
}
