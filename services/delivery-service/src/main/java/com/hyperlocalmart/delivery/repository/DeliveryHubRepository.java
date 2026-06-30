package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.DeliveryHub;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface DeliveryHubRepository extends JpaRepository<DeliveryHub, UUID> {

    Optional<DeliveryHub> findByIdAndStatus(UUID id, String status);
}
