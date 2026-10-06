package com.hyperlocalmart.user.repository;

import com.hyperlocalmart.user.entity.CodPinResetOtp;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

public interface CodPinResetOtpRepository extends JpaRepository<CodPinResetOtp, UUID> {

    @Query("SELECT COUNT(o) FROM CodPinResetOtp o WHERE o.userId = :userId AND o.createdAt >= :since")
    long countByUserIdSince(@Param("userId") UUID userId, @Param("since") Instant since);

    Optional<CodPinResetOtp> findFirstByUserIdAndUsedAtIsNullOrderByCreatedAtDesc(UUID userId);
}
