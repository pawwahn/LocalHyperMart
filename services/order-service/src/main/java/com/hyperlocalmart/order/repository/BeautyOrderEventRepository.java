package com.hyperlocalmart.order.repository;

import com.hyperlocalmart.order.entity.BeautyOrderEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface BeautyOrderEventRepository extends JpaRepository<BeautyOrderEvent, UUID> {
}
