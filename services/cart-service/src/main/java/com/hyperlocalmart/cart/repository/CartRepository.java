package com.hyperlocalmart.cart.repository;

import com.hyperlocalmart.cart.entity.Cart;
import com.hyperlocalmart.cart.entity.CartStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CartRepository extends JpaRepository<Cart, UUID> {

    Optional<Cart> findByUserIdAndTownIdAndStatus(UUID userId, UUID townId, CartStatus status);

    Optional<Cart> findByIdAndUserIdAndTownIdAndStatus(UUID id, UUID userId, UUID townId, CartStatus status);

    List<Cart> findByUserIdAndStatus(UUID userId, CartStatus status);
}
