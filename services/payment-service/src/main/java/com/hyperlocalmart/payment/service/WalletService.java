package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.dto.request.WalletCreditRequest;
import com.hyperlocalmart.payment.dto.request.WalletDebitRequest;
import com.hyperlocalmart.payment.dto.response.WalletBalanceResponse;
import com.hyperlocalmart.payment.entity.WalletAccount;
import com.hyperlocalmart.payment.entity.WalletTransaction;
import com.hyperlocalmart.payment.repository.WalletAccountRepository;
import com.hyperlocalmart.payment.repository.WalletTransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WalletService {

    private final WalletAccountRepository walletAccountRepository;
    private final WalletTransactionRepository walletTransactionRepository;

    @Transactional(readOnly = true)
    public WalletBalanceResponse getBalance(UUID userId) {
        WalletAccount wallet = walletAccountRepository.findByUserId(userId)
                .orElse(null);
        return WalletBalanceResponse.builder()
                .userId(userId)
                .balance(wallet == null ? BigDecimal.ZERO : wallet.getBalance())
                .status(wallet == null ? "ACTIVE" : wallet.getStatus())
                .build();
    }

    @Transactional
    public WalletBalanceResponse credit(WalletCreditRequest request) {
        return walletTransactionRepository
                .findByReferenceTypeAndReferenceIdAndType(
                        request.getReferenceType(), request.getReferenceId(), "CREDIT")
                .map(existing -> getBalance(request.getUserId()))
                .orElseGet(() -> applyCredit(request));
    }

    @Transactional
    public WalletBalanceResponse debit(WalletDebitRequest request) {
        return walletTransactionRepository
                .findByReferenceTypeAndReferenceIdAndType(
                        request.getReferenceType(), request.getReferenceId(), "DEBIT")
                .map(existing -> getBalance(request.getUserId()))
                .orElseGet(() -> applyDebit(request));
    }

    private WalletBalanceResponse applyCredit(WalletCreditRequest request) {
        WalletAccount wallet = getOrCreate(request.getUserId());
        BigDecimal next = wallet.getBalance().add(request.getAmount());
        wallet.setBalance(next);
        walletAccountRepository.save(wallet);
        walletTransactionRepository.save(WalletTransaction.builder()
                .walletId(wallet.getId())
                .type("CREDIT")
                .amount(request.getAmount())
                .balanceAfter(next)
                .referenceType(request.getReferenceType())
                .referenceId(request.getReferenceId())
                .orderId(request.getOrderId())
                .orderItemId(request.getOrderItemId())
                .note(request.getNote())
                .build());
        return WalletBalanceResponse.builder()
                .userId(request.getUserId())
                .balance(next)
                .status(wallet.getStatus())
                .build();
    }

    private WalletBalanceResponse applyDebit(WalletDebitRequest request) {
        WalletAccount wallet = getOrCreate(request.getUserId());
        if (wallet.getBalance().compareTo(request.getAmount()) < 0) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, "Insufficient store credit");
        }
        BigDecimal next = wallet.getBalance().subtract(request.getAmount());
        wallet.setBalance(next);
        walletAccountRepository.save(wallet);
        walletTransactionRepository.save(WalletTransaction.builder()
                .walletId(wallet.getId())
                .type("DEBIT")
                .amount(request.getAmount())
                .balanceAfter(next)
                .referenceType(request.getReferenceType())
                .referenceId(request.getReferenceId())
                .orderId(request.getOrderId())
                .note(request.getNote())
                .build());
        return WalletBalanceResponse.builder()
                .userId(request.getUserId())
                .balance(next)
                .status(wallet.getStatus())
                .build();
    }

    private WalletAccount getOrCreate(UUID userId) {
        return walletAccountRepository.findByUserId(userId)
                .orElseGet(() -> walletAccountRepository.save(WalletAccount.builder()
                        .userId(userId)
                        .balance(BigDecimal.ZERO)
                        .status("ACTIVE")
                        .build()));
    }
}
