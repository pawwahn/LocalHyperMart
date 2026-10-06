package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.WalletAccount;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

public interface WalletAccountRepository extends JpaRepository<WalletAccount, UUID> {
    Optional<WalletAccount> findByUserId(UUID userId);

    @Query("SELECT COALESCE(SUM(w.balance), 0) FROM WalletAccount w WHERE w.balance > 0")
    BigDecimal sumPositiveBalances();

    @Query("SELECT COUNT(w) FROM WalletAccount w WHERE w.balance > 0")
    long countPositiveBalances();
}
