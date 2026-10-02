package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.AgentVendorLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AgentVendorLinkRepository extends JpaRepository<AgentVendorLink, UUID> {

    Optional<AgentVendorLink> findFirstByAgentIdAndActiveTrue(UUID agentId);

    List<AgentVendorLink> findByVendorIdAndActiveTrue(UUID vendorId);

    boolean existsByAgentIdAndShopIdAndActiveTrue(UUID agentId, UUID shopId);
}
