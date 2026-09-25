package com.hyperlocalmart.user.repository;

import com.hyperlocalmart.user.entity.ReferralAttribution;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ReferralAttributionRepository extends JpaRepository<ReferralAttribution, UUID> {

    Optional<ReferralAttribution> findByRefereeUserId(UUID refereeUserId);

    boolean existsByRefereeUserId(UUID refereeUserId);
}
