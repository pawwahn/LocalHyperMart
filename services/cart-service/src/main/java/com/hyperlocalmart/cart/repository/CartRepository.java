package com.hyperlocalmart.cart.repository;

import com.hyperlocalmart.cart.entity.Cart;
import com.hyperlocalmart.cart.entity.CartStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CartRepository extends JpaRepository<Cart, UUID> {

    Optional<Cart> findByUserIdAndTownIdAndStatus(UUID userId, UUID townId, CartStatus status);

    Optional<Cart> findByIdAndUserIdAndTownIdAndStatus(UUID id, UUID userId, UUID townId, CartStatus status);

    List<Cart> findByUserIdAndStatus(UUID userId, CartStatus status);

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update Cart c
            set c.status = :abandoned, c.promoCode = null, c.promoDiscount = 0
            where c.id = :cartId and c.status = :active
            """)
    int abandonIfActive(
            @Param("cartId") UUID cartId,
            @Param("abandoned") CartStatus abandoned,
            @Param("active") CartStatus active);
}
