package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.LaundryOrderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LaundryOrderEventRepository extends JpaRepository<LaundryOrderEvent, UUID> {

    List<LaundryOrderEvent> findByOrderIdOrderByCreatedAtAsc(UUID orderId);
}
