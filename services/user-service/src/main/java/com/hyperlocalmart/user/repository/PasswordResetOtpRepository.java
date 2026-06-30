package com.hyperlocalmart.user.repository;

import com.hyperlocalmart.user.entity.PasswordResetOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface PasswordResetOtpRepository extends JpaRepository<PasswordResetOtp, UUID> {

    Optional<PasswordResetOtp> findFirstByPhoneAndUsedAtIsNullOrderByCreatedAtDesc(String phone);

    @Query("SELECT COUNT(p) FROM PasswordResetOtp p WHERE p.phone = :phone AND p.createdAt >= :since")
    long countByPhoneSince(String phone, Instant since);
}
