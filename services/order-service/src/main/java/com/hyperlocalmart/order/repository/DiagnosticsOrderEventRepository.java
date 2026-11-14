package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.DiagnosticsOrderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DiagnosticsOrderEventRepository extends JpaRepository<DiagnosticsOrderEvent, UUID> {

    List<DiagnosticsOrderEvent> findByOrderIdOrderByCreatedAtAsc(UUID orderId);
}
