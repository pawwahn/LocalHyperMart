package com.hyperlocalmart.payment.service;

import com.hyperlocalmart.common.exception.BusinessException;
import com.hyperlocalmart.common.exception.ErrorCode;
import com.hyperlocalmart.payment.client.OrderClient;
import com.hyperlocalmart.payment.dto.request.WalletCreditRequest;
import com.hyperlocalmart.payment.dto.request.WalletDebitRequest;
import com.hyperlocalmart.payment.dto.response.WalletBalanceResponse;
import com.hyperlocalmart.payment.dto.response.WalletTransactionListResponse;
import com.hyperlocalmart.payment.dto.response.WalletTransactionResponse;
import com.hyperlocalmart.payment.entity.WalletAccount;
import com.hyperlocalmart.payment.entity.WalletTransaction;
import com.hyperlocalmart.payment.repository.WalletAccountRepository;
import com.hyperlocalmart.payment.repository.WalletTransactionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class WalletService {

    private static final Pattern ORDER_NUMBER_IN_NOTE = Pattern.compile(
            "\\b([A-Z0-9]{2,12}/[A-Z0-9]{2,12}-\\d{2,}[A-Z0-9-]*)\\b");

    private final WalletAccountRepository walletAccountRepository;
    private final WalletTransactionRepository walletTransactionRepository;
    private final OrderClient orderClient;

    /** Ensures every buyer has a wallet row; returns current balance (often ₹0). */
    @Transactional
    public WalletBalanceResponse getBalance(UUID userId) {
        WalletAccount wallet = getOrCreate(userId);
        return WalletBalanceResponse.builder()
                .userId(userId)
                .balance(wallet.getBalance())
                .status(wallet.getStatus())
                .build();
    }

    @Transactional(readOnly = true)
    public WalletTransactionListResponse listTransactions(UUID userId, int limit, int offset) {
        WalletAccount wallet = walletAccountRepository.findByUserId(userId).orElse(null);
        if (wallet == null) {
            return WalletTransactionListResponse.builder()
                    .items(List.of())
                    .hasMore(false)
                    .offset(0)
                    .limit(Math.min(Math.max(limit, 1), 50))
                    .build();
        }
        int size = Math.min(Math.max(limit, 1), 50);
        int from = Math.max(offset, 0);
        int pageIndex = from / size;
        var result = walletTransactionRepository.findByWalletIdOrderByCreatedAtDesc(
                wallet.getId(), PageRequest.of(pageIndex, size));
        List<WalletTransaction> page = result.getContent();
        Map<UUID, String> orderNumbers = resolveOrderNumbers(userId, page);
        List<WalletTransactionResponse> items = page.stream()
                .map(tx -> toTransactionResponse(tx, orderNumbers))
                .toList();
        return WalletTransactionListResponse.builder()
                .items(items)
                .hasMore(result.hasNext())
                .offset(pageIndex * size)
                .limit(size)
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

    private Map<UUID, String> resolveOrderNumbers(UUID buyerId, List<WalletTransaction> rows) {
        Map<UUID, String> out = new HashMap<>();
        rows.stream()
                .map(WalletTransaction::getOrderId)
                .filter(Objects::nonNull)
                .distinct()
                .forEach(orderId -> {
                    try {
                        OrderClient.OrderSnapshot snap = orderClient.getOrder(orderId, buyerId);
                        if (snap != null && snap.orderNumber() != null && !snap.orderNumber().isBlank()) {
                            out.put(orderId, snap.orderNumber());
                        }
                    } catch (RuntimeException ex) {
                        log.debug("Could not resolve order number for {}: {}", orderId, ex.getMessage());
                    }
                });
        return out;
    }

    private WalletTransactionResponse toTransactionResponse(
            WalletTransaction tx, Map<UUID, String> orderNumbers) {
        String orderNumber = null;
        if (tx.getOrderId() != null) {
            orderNumber = orderNumbers.get(tx.getOrderId());
        }
        if (orderNumber == null || orderNumber.isBlank()) {
            orderNumber = extractOrderNumberFromNote(tx.getNote());
        }
        return WalletTransactionResponse.builder()
                .id(tx.getId())
                .type(tx.getType())
                .amount(tx.getAmount())
                .balanceAfter(tx.getBalanceAfter())
                .referenceType(tx.getReferenceType())
                .referenceId(tx.getReferenceId())
                .orderId(tx.getOrderId())
                .orderNumber(orderNumber)
                .orderItemId(tx.getOrderItemId())
                .note(tx.getNote())
                .createdAt(tx.getCreatedAt() == null ? null : tx.getCreatedAt().toString())
                .title(friendlyTitle(tx))
                .build();
    }

    private static String extractOrderNumberFromNote(String note) {
        if (note == null || note.isBlank()) {
            return null;
        }
        Matcher matcher = ORDER_NUMBER_IN_NOTE.matcher(note);
        return matcher.find() ? matcher.group(1) : null;
    }

    private String friendlyTitle(WalletTransaction tx) {
        String ref = tx.getReferenceType() == null ? "" : tx.getReferenceType();
        boolean credit = "CREDIT".equalsIgnoreCase(tx.getType());
        if ("ORDER_ITEM_CANCEL".equals(ref)) {
            return credit ? "Store credit added - shop cancelled an item" : "Store credit adjustment";
        }
        if ("ORDER_ITEM_RESTORE".equals(ref)) {
            return "Store credit removed - shop restored an item";
        }
        if ("ORDER_CHECKOUT".equals(ref)) {
            return "Used on an order at checkout";
        }
        if (tx.getNote() != null && !tx.getNote().isBlank()) {
            return tx.getNote();
        }
        return credit ? "Store credit added" : "Store credit used";
    }
}
