package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.LaundryOrderMessage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface LaundryOrderMessageRepository extends JpaRepository<LaundryOrderMessage, UUID> {

    List<LaundryOrderMessage> findByOrderIdOrderByCreatedAtAsc(UUID orderId);

    long countByOrderId(UUID orderId);
}
