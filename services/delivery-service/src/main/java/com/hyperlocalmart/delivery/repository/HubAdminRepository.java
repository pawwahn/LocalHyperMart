package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.HubAdmin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface HubAdminRepository extends JpaRepository<HubAdmin, UUID> {

    Optional<HubAdmin> findByUserIdAndStatus(UUID userId, String status);
}
