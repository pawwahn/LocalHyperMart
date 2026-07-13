package com.hyperlocalmart.delivery.repository;

import com.hyperlocalmart.delivery.entity.DeliveryEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface DeliveryEventRepository extends JpaRepository<DeliveryEvent, UUID> {

    List<DeliveryEvent> findByAssignmentIdOrderByCreatedAtAsc(UUID assignmentId);

    List<DeliveryEvent> findByAssignmentIdInOrderByCreatedAtAsc(Collection<UUID> assignmentIds);
}
