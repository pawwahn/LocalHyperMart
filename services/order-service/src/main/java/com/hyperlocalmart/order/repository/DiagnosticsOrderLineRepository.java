package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.DiagnosticsOrderLine;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface DiagnosticsOrderLineRepository extends JpaRepository<DiagnosticsOrderLine, UUID> {

    List<DiagnosticsOrderLine> findByOrderIdOrderByTestNameAsc(UUID orderId);
}
