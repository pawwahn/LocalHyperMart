package com.hyperlocalmart.payment.web;

import com.hyperlocalmart.common.api.ApiResponse;
import com.hyperlocalmart.payment.dto.request.WalletCreditRequest;
import com.hyperlocalmart.payment.dto.request.WalletDebitRequest;
import com.hyperlocalmart.payment.dto.response.WalletBalanceResponse;
import com.hyperlocalmart.payment.service.WalletService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/internal/wallet")
@RequiredArgsConstructor
public class WalletInternalController {

    private final WalletService walletService;

    @GetMapping("/{userId}")
    public ResponseEntity<ApiResponse<WalletBalanceResponse>> balance(
            @PathVariable UUID userId,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, walletService.getBalance(userId)));
    }

    @PostMapping("/credit")
    public ResponseEntity<ApiResponse<WalletBalanceResponse>> credit(
            @Valid @RequestBody WalletCreditRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponses.ok(httpRequest, walletService.credit(request)));
    }

    @PostMapping("/debit")
    public ResponseEntity<ApiResponse<WalletBalanceResponse>> debit(
            @Valid @RequestBody WalletDebitRequest request,
            HttpServletRequest httpRequest) {
        return ResponseEntity.ok(ApiResponses.ok(httpRequest, walletService.debit(request)));
    }
}
