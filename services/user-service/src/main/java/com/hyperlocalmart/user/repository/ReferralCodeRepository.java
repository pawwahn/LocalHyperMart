package com.hyperlocalmart.user.repository;

import com.hyperlocalmart.user.entity.ReferralCode;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ReferralCodeRepository extends JpaRepository<ReferralCode, UUID> {

    Optional<ReferralCode> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);
}
