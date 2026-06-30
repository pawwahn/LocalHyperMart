package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.AssignmentStatus;
import com.hyperlocalmart.delivery.entity.DeliveryAssignment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DeliveryAssignmentRepository extends JpaRepository<DeliveryAssignment, UUID> {

    List<DeliveryAssignment> findByOrderIdOrderByAssignedAtDesc(UUID orderId);

    boolean existsByVendorSubOrderIdAndLegTypeAndStatusIn(
            UUID vendorSubOrderId, AssignmentLegType legType, Collection<AssignmentStatus> statuses);

    boolean existsByOrderIdAndLegTypeAndStatusIn(
            UUID orderId, AssignmentLegType legType, Collection<AssignmentStatus> statuses);

    Optional<DeliveryAssignment> findByVendorSubOrderIdAndLegTypeAndStatus(
            UUID vendorSubOrderId, AssignmentLegType legType, AssignmentStatus status);

    List<DeliveryAssignment> findByAgentIdOrderByAssignedAtDesc(UUID agentId);

    List<DeliveryAssignment> findByAgentIdAndStatusOrderByAssignedAtDesc(UUID agentId, AssignmentStatus status);
}
