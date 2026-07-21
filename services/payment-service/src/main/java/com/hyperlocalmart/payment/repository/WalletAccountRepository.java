package com.hyperlocalmart.payment.repository;

import com.hyperlocalmart.payment.entity.WalletAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface WalletAccountRepository extends JpaRepository<WalletAccount, UUID> {
    Optional<WalletAccount> findByUserId(UUID userId);
}
