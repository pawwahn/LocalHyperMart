package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.DeliveryAgentAlert;
import com.hyperlocalmart.delivery.entity.DeliveryAgentAlertStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryAgentAlertRepository extends JpaRepository<DeliveryAgentAlert, UUID> {

    boolean existsByAssignmentIdAndStatus(UUID assignmentId, DeliveryAgentAlertStatus status);

    List<DeliveryAgentAlert> findByAgentIdAndStatusOrderByCreatedAtDesc(
            UUID agentId, DeliveryAgentAlertStatus status);

    Optional<DeliveryAgentAlert> findByIdAndAgentId(UUID id, UUID agentId);

    List<DeliveryAgentAlert> findByVendorSubOrderIdInOrderByCreatedAtDesc(Collection<UUID> vendorSubOrderIds);
}
