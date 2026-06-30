package com.hyperlocalmart.cart.repository;

import com.hyperlocalmart.cart.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CartItemRepository extends JpaRepository<CartItem, UUID> {

    Optional<CartItem> findByIdAndCartUserId(UUID id, UUID userId);
}
