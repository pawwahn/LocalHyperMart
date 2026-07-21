package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.WalletTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WalletTransactionRepository extends JpaRepository<WalletTransaction, UUID> {
    Optional<WalletTransaction> findByReferenceTypeAndReferenceIdAndType(
            String referenceType, UUID referenceId, String type);

    List<WalletTransaction> findByWalletIdOrderByCreatedAtDesc(UUID walletId);
}
