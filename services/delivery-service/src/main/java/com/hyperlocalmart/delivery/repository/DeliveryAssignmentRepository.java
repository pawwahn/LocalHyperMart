package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.AssignmentLegType;
import com.hyperlocalmart.delivery.entity.AssignmentStatus;
import com.hyperlocalmart.delivery.entity.DeliveryAssignment;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
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

    Page<DeliveryAssignment> findByAgentIdOrderByAssignedAtDesc(UUID agentId, Pageable pageable);

    Page<DeliveryAssignment> findByAgentIdAndStatusInOrderByAssignedAtDesc(
            UUID agentId, Collection<AssignmentStatus> statuses, Pageable pageable);

    Page<DeliveryAssignment> findByAgentIdAndStatusOrderByAssignedAtDesc(
            UUID agentId, AssignmentStatus status, Pageable pageable);

    List<DeliveryAssignment> findByAssignmentNumberIsNull();

    long countByHubIdAndLegTypeAndStatus(UUID hubId, AssignmentLegType legType, AssignmentStatus status);

    @Query("""
            SELECT COUNT(a) FROM DeliveryAssignment a
            WHERE a.hubId = :hubId
              AND a.legType = :legType
              AND a.status = com.hyperlocalmart.delivery.entity.AssignmentStatus.COMPLETED
              AND a.completedAt >= :start AND a.completedAt < :end
            """)
    long countCompletedByHubIdAndLegTypeBetween(
            UUID hubId, AssignmentLegType legType, Instant start, Instant end);

    long countByHubIdAndStatusIn(UUID hubId, Collection<AssignmentStatus> statuses);

    long countByAgentIdAndLegTypeAndStatus(UUID agentId, AssignmentLegType legType, AssignmentStatus status);

    long countByAgentIdAndLegTypeAndStatusIn(
            UUID agentId, AssignmentLegType legType, Collection<AssignmentStatus> statuses);

    long countByAgentIdAndLegTypeAndStatusInAndUpdatedAtBetween(
            UUID agentId,
            AssignmentLegType legType,
            Collection<AssignmentStatus> statuses,
            Instant updatedAtStart,
            Instant updatedAtEnd);

    @Query("""
            SELECT COUNT(a) FROM DeliveryAssignment a
            WHERE a.agentId = :agentId
              AND a.legType = :legType
              AND a.status = com.hyperlocalmart.delivery.entity.AssignmentStatus.COMPLETED
              AND a.completedAt >= :start AND a.completedAt < :end
            """)
    long countCompletedByAgentIdAndLegTypeBetween(
            UUID agentId, AssignmentLegType legType, Instant start, Instant end);

    @Query("""
            SELECT a.agentId, a.legType, COUNT(a) FROM DeliveryAssignment a
            WHERE a.hubId = :hubId
              AND a.status = com.hyperlocalmart.delivery.entity.AssignmentStatus.COMPLETED
              AND a.completedAt >= :start AND a.completedAt < :end
            GROUP BY a.agentId, a.legType
            """)
    List<Object[]> countCompletedGroupedByAgentAndLeg(UUID hubId, Instant start, Instant end);
}
