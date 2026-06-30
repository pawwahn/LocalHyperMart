package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.AgentHubLink;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AgentHubLinkRepository extends JpaRepository<AgentHubLink, UUID> {

    List<AgentHubLink> findByHubIdAndActiveTrue(UUID hubId);

    Optional<AgentHubLink> findFirstByAgentIdAndActiveTrue(UUID agentId);

    boolean existsByAgentIdAndHubIdAndActiveTrue(UUID agentId, UUID hubId);

    Optional<AgentHubLink> findByAgentIdAndHubIdAndActiveTrue(UUID agentId, UUID hubId);
}
