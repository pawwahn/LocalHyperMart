package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.AgentType;
import com.hyperlocalmart.delivery.entity.DeliveryAgent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryAgentRepository extends JpaRepository<DeliveryAgent, UUID> {

    Optional<DeliveryAgent> findByUserId(UUID userId);

    boolean existsByUserId(UUID userId);

    boolean existsByPhone(String phone);

    List<DeliveryAgent> findByVendorIdAndAgentTypeOrderByNameAsc(UUID vendorId, AgentType agentType);

    Optional<DeliveryAgent> findByIdAndVendorIdAndAgentType(UUID id, UUID vendorId, AgentType agentType);
}
