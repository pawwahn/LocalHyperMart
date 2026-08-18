package com.hyperlocalmart.cart.repository;

import com.hyperlocalmart.cart.entity.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface CartItemRepository extends JpaRepository<CartItem, UUID> {

    Optional<CartItem> findByIdAndCartUserId(UUID id, UUID userId);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("delete from CartItem i where i.cart.id = :cartId")
    int deleteByCartId(@Param("cartId") UUID cartId);
}
